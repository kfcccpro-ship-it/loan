#!/usr/bin/env python3
import json
import os
import random
import re
import sys
import zipfile
from collections import defaultdict
from lxml import etree

ARTICLE_RE = re.compile(r'^(제\s*\d+\s*조(?:의\s*\d+)?)(?:\(([^)]+)\))?\s*(.*)$')
PART_RE = re.compile(r'^제\s*\d+\s*편\s+')
CHAPTER_RE = re.compile(r'^제\s*\d+\s*장\s+')
SECTION_RE = re.compile(r'^제\s*\d+\s*절\s+')
CLAUSE_PATTERNS = [
    re.compile(r'^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*(.*)$'),
    re.compile(r'^([1-9]\d*)\.\s*(.*)$'),
    re.compile(r'^([가-하])\.\s*(.*)$'),
    re.compile(r'^(\([1-9]\d*\))\s*(.*)$'),
]


def normalize_space(text: str) -> str:
    text = text.replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def get_text(p):
    texts = []
    for t in p.iter():
        tag = t.tag.split('}')[-1]
        if tag == 't':
            texts.append(''.join(t.itertext()))
        elif tag == 'lineBreak':
            texts.append('\n')
        elif tag == 'tab':
            texts.append('\t')
    return ''.join(texts).strip()


def classify_line(line):
    line = normalize_space(line)
    for pat in CLAUSE_PATTERNS:
        m = pat.match(line)
        if m:
            return m.group(1), normalize_space(m.group(2))
    return '', line


def article_num_key(article_no):
    m = re.match(r'제\s*(\d+)\s*조(?:의\s*(\d+))?', article_no)
    major = int(m.group(1)) if m else 999999
    minor = int(m.group(2)) if m and m.group(2) else 0
    return (major, minor)


def article_num_only(article_no):
    return article_num_key(article_no)[0]


def full_title(article_no, title):
    return f'{article_no}({title})' if title else article_no


def short_text(text, limit=110):
    text = normalize_space(text)
    return text if len(text) <= limit else text[: limit - 1] + '…'


def statement_candidates(article):
    cands = []
    for block in article['blocks']:
        txt = normalize_space(block['text'])
        if len(txt) < 12:
            continue
        if txt.startswith('삭제'):
            continue
        cands.append({
            'label': block['label'],
            'text': txt,
            'article_no': article['article_no'],
            'title': article['title'],
            'part': article['part'],
            'chapter': article['chapter'],
            'section': article['section'],
            'article_num': article['article_num']
        })
    if not cands and article['full_text']:
        cands.append({
            'label': '',
            'text': article['full_text'],
            'article_no': article['article_no'],
            'title': article['title'],
            'part': article['part'],
            'chapter': article['chapter'],
            'section': article['section'],
            'article_num': article['article_num']
        })
    return cands


def parse_hwpx(src_path):
    zf = zipfile.ZipFile(src_path)
    section_files = sorted([n for n in zf.namelist() if re.match(r'Contents/section\d+\.xml$', n)])
    raw_lines = []
    for section in section_files:
        xml = zf.read(section)
        root = etree.fromstring(xml)
        hp = root.nsmap['hp']
        paras = root.findall('.//{%s}p' % hp)
        raw_lines.extend([get_text(p) for p in paras])
    raw_lines = [normalize_space(x) for x in raw_lines if normalize_space(x)]

    current_part = current_chapter = current_section = ''
    current = None
    articles = []
    appendix_mode = False

    for line in raw_lines:
        if line.startswith('부칙'):
            appendix_mode = True
        if PART_RE.match(line):
            current_part = line
            current_chapter = ''
            current_section = ''
            appendix_mode = False
            continue
        if CHAPTER_RE.match(line):
            current_chapter = line
            current_section = ''
            continue
        if SECTION_RE.match(line):
            current_section = line
            continue

        m = ARTICLE_RE.match(line)
        if m:
            if current:
                articles.append(current)
            article_no, title, rest = m.groups()
            current = {
                'part': current_part if not appendix_mode else '부칙',
                'chapter': current_chapter,
                'section': current_section,
                'article_no': normalize_space(article_no),
                'title': normalize_space(title or ''),
                'content_lines': []
            }
            if normalize_space(rest):
                current['content_lines'].append(normalize_space(rest))
        elif current:
            current['content_lines'].append(line)

    if current:
        articles.append(current)

    data = []
    for idx, art in enumerate(articles, start=1):
        blocks = []
        for line in art['content_lines']:
            label, text = classify_line(line)
            if text:
                blocks.append({'label': label, 'text': text})
        text_chunks = [f"{b['label']} {b['text']}".strip() for b in blocks]
        article_no = art['article_no']
        data.append({
            'id': f'a{idx}',
            'part': art['part'],
            'chapter': art['chapter'],
            'section': art['section'],
            'article_no': article_no,
            'article_num': article_num_only(article_no),
            'article_key': article_num_key(article_no),
            'title': art['title'],
            'full_title': full_title(article_no, art['title']),
            'blocks': blocks,
            'full_text': ' '.join(text_chunks)
        })
    return data


def build_quiz(data, max_ox=220, max_mcq=180):
    rnd = random.Random(20260331)
    candidates = []
    by_article = {}
    by_part = defaultdict(list)
    by_chapter = defaultdict(list)
    for article in data:
        cands = statement_candidates(article)
        if cands:
            by_article[article['article_no']] = cands
            candidates.extend(cands)
            by_part[article['part']].extend(cands)
            by_chapter[(article['part'], article['chapter'])].extend(cands)

    quiz = []

    # OX questions: true and false balanced.
    ox_base = candidates[:]
    rnd.shuffle(ox_base)
    ox_true = ox_base[: max_ox // 2]
    for idx, s in enumerate(ox_true, start=1):
        quiz.append({
            'id': f'ox-t-{idx}',
            'type': 'ox',
            'prompt': f'다음 문장이 {s["article_no"]}{f"({s["title"]})" if s["title"] else ""}의 내용으로 맞으면 O, 아니면 X를 선택하세요.',
            'statement': short_text(s['text'], 150),
            'answer': True,
            'source_article_no': s['article_no'],
            'source_title': s['title'],
            'source_clause': s['label'],
            'source_text': s['text'],
            'source_part': s['part'],
            'source_chapter': s['chapter'],
            'source_section': s['section'],
            'source_article_num': s['article_num']
        })

    false_targets = ox_base[max_ox // 2 : max_ox]
    for idx, s in enumerate(false_targets, start=1):
        pool = [x for x in by_part[s['part']] if x['article_no'] != s['article_no']]
        if len(pool) < 3:
            pool = [x for x in candidates if x['article_no'] != s['article_no']]
        if not pool:
            continue
        other = rnd.choice(pool)
        quiz.append({
            'id': f'ox-f-{idx}',
            'type': 'ox',
            'prompt': f'다음 문장이 {s["article_no"]}{f"({s["title"]})" if s["title"] else ""}의 내용으로 맞으면 O, 아니면 X를 선택하세요.',
            'statement': short_text(other['text'], 150),
            'answer': False,
            'source_article_no': s['article_no'],
            'source_title': s['title'],
            'source_clause': s['label'],
            'source_text': s['text'],
            'source_part': s['part'],
            'source_chapter': s['chapter'],
            'source_section': s['section'],
            'source_article_num': s['article_num']
        })

    # MCQ: choose one correct statement for target article.
    article_list = [a for a in data if by_article.get(a['article_no'])]
    rnd.shuffle(article_list)
    mcq_targets = article_list[:max_mcq]
    for idx, article in enumerate(mcq_targets, start=1):
        correct_stmt = rnd.choice(by_article[article['article_no']])
        local_pool = [x for x in by_chapter[(article['part'], article['chapter'])] if x['article_no'] != article['article_no']]
        if len(local_pool) < 3:
            local_pool = [x for x in by_part[article['part']] if x['article_no'] != article['article_no']]
        if len(local_pool) < 3:
            local_pool = [x for x in candidates if x['article_no'] != article['article_no']]
        seen = set()
        distractors = []
        for cand in local_pool:
            key = short_text(cand['text'], 90)
            if key in seen:
                continue
            seen.add(key)
            distractors.append(cand)
            if len(distractors) == 3:
                break
        if len(distractors) < 3:
            continue
        choices = [short_text(correct_stmt['text'], 110)] + [short_text(d['text'], 110) for d in distractors]
        order = list(range(4))
        rnd.shuffle(order)
        shuffled = [choices[i] for i in order]
        answer_index = order.index(0)
        quiz.append({
            'id': f'mcq-{idx}',
            'type': 'mcq',
            'prompt': f'다음 중 {article["article_no"]}{f"({article["title"]})" if article["title"] else ""}의 내용으로 옳은 것은?',
            'choices': shuffled,
            'answer_index': answer_index,
            'source_article_no': article['article_no'],
            'source_title': article['title'],
            'source_clause': correct_stmt['label'],
            'source_text': correct_stmt['text'],
            'source_part': article['part'],
            'source_chapter': article['chapter'],
            'source_section': article['section'],
            'source_article_num': article['article_num']
        })

    quiz.sort(key=lambda q: (q['source_article_num'] or 999999, q['type'], q['id']))
    return quiz


def main(src_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    data = parse_hwpx(src_path)
    quiz = build_quiz(data)
    with open(os.path.join(out_dir, 'data.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(os.path.join(out_dir, 'quiz.json'), 'w', encoding='utf-8') as f:
        json.dump(quiz, f, ensure_ascii=False, indent=2)
    print(f'완료: data.json {len(data)}개 조문, quiz.json {len(quiz)}문제 생성')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('사용법: python parser.py <입력.hwpx> <출력폴더>')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
