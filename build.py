"""Build the complete, searchable static guide. Requires Python 3 only."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / 'content.json').read_text())
icons = dict(zip([c['id'] for c in data['chapters']], [
    'car-profile', 'gear', 'eye', 'shield-check', 'steering-wheel',
    'snowflake', 'seat', 'wrench', 'engine'
]))

def icon(name, cls=''):
    return f'<span class="icon {cls}" aria-hidden="true" style="--icon:url(assets/icons/{name}.svg)"></span>'

navigation, chapters, options = [], [], []
for index, chapter in enumerate(data['chapters']):
    ident = escape(chapter['id'])
    count = sum(len(group['items']) for group in chapter['groups'])
    navigation.append(f'''<a class="chapter-link" data-chapter="{ident}" href="#{ident}">
      {icon(icons[ident])}<span>{escape(chapter['shortTitle'])}</span>{icon('arrow-up-right', 'chapter-link-arrow')}
    </a>''')
    options.append(f'<option value="{ident}">{index+1}. {escape(chapter["shortTitle"])}</option>')
    groups = []
    for group in chapter['groups']:
        items = '\n'.join(f'<li id="{escape(item["id"])}" class="note"><p>{escape(item["text"])}</p></li>' for item in group['items'])
        groups.append(f'<section class="note-group"><h4>{escape(group["title"])}</h4><ul>{items}</ul></section>')
    prev = data['chapters'][(index - 1) % len(data['chapters'])]
    nxt = data['chapters'][(index + 1) % len(data['chapters'])]
    chapters.append(f'''<article class="chapter" id="{ident}" aria-labelledby="title-{ident}">
      <header class="chapter-heading">
        <div class="chapter-meta"><span>Глава {index+1} из 9</span><span>{count} заметок</span></div>
        <h3 id="title-{ident}" tabindex="-1">{escape(chapter['title'])}</h3>
        <p>{escape(chapter['dek'])}</p>
      </header>
      {''.join(groups)}
      <nav class="chapter-pager" aria-label="Навигация между главами">
        <a href="#{prev['id']}" data-chapter="{prev['id']}" class="previous-chapter" aria-label="Предыдущая глава: {escape(prev['shortTitle'])}">{icon('arrow-left')}<span class="previous-label">{escape(prev['shortTitle'])}</span></a>
        <a href="#{nxt['id']}" data-chapter="{nxt['id']}" class="next-chapter"><span>Дальше: {escape(nxt['shortTitle'])}</span>{icon('arrow-right')}</a>
      </nav>
    </article>''')

checklist = '\n'.join(f'''<label class="check-item" for="check-{item['id']}">
  <input type="checkbox" id="check-{item['id']}" data-check="{item['id']}">
  <span class="check-box" aria-hidden="true">{icon('check')}</span>
  <span class="check-text">{escape(item['text'])}</span>
</label>''' for item in data['checklist'])

safety = '\n'.join(f'''<details class="safety-note"><summary>{escape(note['title'].rstrip('.'))}{icon('plus')}</summary><p>{escape(note['text'])}</p></details>''' for note in data['safetyNotes'])
kit = data['carKit']
priority_names = {'required': 'Обязательно · Молдова', 'essential': 'База', 'recommended': 'Желательно', 'optional': 'По желанию', 'seasonal': 'По сезону'}
kit_groups = []
for number, group in enumerate(kit['groups'], 1):
    rows = []
    for item in group['items']:
        ident = escape(item['id'])
        rows.append(f'''<label class="kit-item" id="kit-item-{ident}" for="kit-check-{ident}">
          <input type="checkbox" id="kit-check-{ident}" value="{ident}" data-kit-check>
          <span class="check-box" aria-hidden="true">{icon('check')}</span>
          <span class="kit-item-copy"><span class="kit-item-title">{escape(item['title'])}</span><span class="kit-item-detail">{escape(item['detail'])}</span><span class="kit-item-meta"><span class="kit-priority kit-priority-{escape(item['priority'])}">{priority_names[item['priority']]}</span><span>{escape(item['location'])}</span></span></span>
        </label>''')
    kit_groups.append(f'''<details class="kit-group" data-kit-group="{escape(group['id'])}" {'open' if number == 1 else ''}>
      <summary><span class="kit-group-number">{number:02}</span><span class="kit-group-name">{escape(group['title'])}</span><span data-kit-group-count>0 из {len(group['items'])}</span>{icon('plus')}</summary>
      <div class="kit-group-body"><p class="kit-group-description">{escape(group['description'])}</p><div class="kit-items">{''.join(rows)}</div><p class="kit-group-empty" hidden>В этом разделе всё отмечено.</p></div>
    </details>''')
kit_sources = ''.join(f'<li><a href="{escape(source["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{escape(source["title"])}</a></li>' for source in kit['sources'])
kit_count = sum(len(group['items']) for group in kit['groups'])
template = (ROOT / 'templates/index.html').read_text()
for key, value in {'NAVIGATION': '\n'.join(navigation), 'CHAPTERS': '\n'.join(chapters),
    'OPTIONS': ''.join(options), 'CHECKLIST': checklist, 'SAFETY': safety,
    'KIT_GROUPS': ''.join(kit_groups), 'KIT_COUNT': str(kit_count),
    'KIT_INTRO': escape(kit['intro']), 'KIT_SOURCES': kit_sources}.items():
    template = template.replace('%%' + key + '%%', value)
assert '%%' not in template
(ROOT / 'index.html').write_text(template)
(ROOT / 'content.js').write_text('window.GUIDE_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Built {len(chapters)} chapters, {sum(len(g["items"]) for c in data["chapters"] for g in c["groups"])} notes, {len(data["checklist"])} checks.')
