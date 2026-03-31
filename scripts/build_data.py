#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from lxml import etree

NS = {'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph'}


def extract_paragraphs_from_hwpx(hwpx_path: Path):
    import zipfile
    with zipfile.ZipFile(hwpx_path, 'r') as zf:
        with zf.open('Contents/section0.xml') as f:
            root = etree.parse(f)
    paras = []
    for p in root.xpath('//hp:p', namespaces=NS):
        texts = p.xpath('.//hp:t/text()', namespaces=NS)
        txt = ''.join(texts).replace('\xa0', ' ').strip()
        if txt:
            paras.append(re.sub(r'\s+', ' ', txt))
    return paras


def parse_articles(paras):
    articles = []
    parts_order = []
    chapters_order = []
    part = None
    chapter = None
    supplementary = False
    current = None

    def flush_current():
        nonlocal current
        if current:
            current['body'] = current['body'].strip()
            current['search_text'] = ' '.join([
                current['part'], current['chapter'], current['article_no'], current['title'], current['body']
            ])
            current['quiz_eligible'] = (not current['supplementary']) and current['title'] not in ('시행일', '경과조치')
            articles.append(current)
            current = None

    for raw in paras:
        text = raw.strip()
        if text == '여신업무방법서':
            continue
        if re.match(r'^부칙', text):
            flush_current()
            supplementary = True
            part = '부칙'
            chapter = text
            if part not in parts_order:
                parts_order.append(part)
            if (part, chapter) not in chapters_order:
                chapters_order.append((part, chapter))
            continue
        part_match = re.match(r'^(제\d+편)\s+(.+)$', text)
        if part_match and not supplementary:
            flush_current()
            part = text
            chapter = None
            if part not in parts_order:
                parts_order.append(part)
            continue
        chapter_match = re.match(r'^(제\d+장)\s+(.+)$', text)
        if chapter_match and not supplementary:
            flush_current()
            chapter = text
            if (part, chapter) not in chapters_order:
                chapters_order.append((part, chapter))
            continue
        art_match = re.match(r'^(제\d+조(?:의\d+)?)(?:\(([^)]+)\))?\s*(.*)$', text)
        if art_match:
            flush_current()
            current = {
                'id': len(articles) + 1,
                'part': part or '미분류',
                'chapter': chapter or '미분류',
                'article_no': art_match.group(1),
                'title': (art_match.group(2) or '').strip(),
                'display_title': f"{art_match.group(1)}({(art_match.group(2) or '').strip()})" if art_match.group(2) else art_match.group(1),
                'body': art_match.group(3).strip(),
                'supplementary': supplementary,
            }
        else:
            if current:
                current['body'] += ('\n' if current['body'] else '') + text

    flush_current()
    return articles, parts_order, chapters_order


def build_payload(hwpx_path: Path):
    paras = extract_paragraphs_from_hwpx(hwpx_path)
    articles, parts_order, chapters_order = parse_articles(paras)
    chapters = {}
    for part, chapter in chapters_order:
        chapters.setdefault(part, []).append(chapter)
    payload = {
        'meta': {
            'source_file': hwpx_path.name,
            'article_count': len(articles),
            'quiz_eligible_count': sum(1 for a in articles if a['quiz_eligible']),
            'generated_by': 'scripts/build_data.py',
        },
        'parts': parts_order,
        'chapters': chapters,
        'articles': articles,
    }
    return payload


def main():
    if len(sys.argv) < 3:
        print('Usage: build_data.py <input.hwpx> <output.json>')
        sys.exit(1)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    payload = build_payload(src)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'[OK] wrote {out} with {payload["meta"]["article_count"]} articles')


if __name__ == '__main__':
    main()
