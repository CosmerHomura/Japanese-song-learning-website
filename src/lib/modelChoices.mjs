export function modelLabel(model) {
  return String(model.name || model.id).replace(/^[^:]+:\s*/, '').trim()
}

export function modelChoices(models, selectedId, showAll = false, query = '') {
  const search = query.trim().toLowerCase()
  const unique = [...new Map(models.map((model) => [model.id, model])).values()]
  const matches = unique.filter((model) => !search || `${modelLabel(model)} ${model.id}`.toLowerCase().includes(search))
  if (showAll || search) return matches
  const stable = matches.filter((model) => !/(?:batch|distill|preview|experimental|(?:^|[-\s])exp(?:$|[-\s])|[- ]\d{4,8}(?:$|[-\s]))/i.test(`${model.id} ${model.name}`))
  const shortlist = (stable.length ? stable : matches).slice().sort((a, b) =>
    String(b.release_date || '').localeCompare(String(a.release_date || '')) || b.id.localeCompare(a.id, undefined, { numeric: true })
  ).slice(0, 6)
  const selected = unique.find((model) => model.id === selectedId)
  if (selected && !shortlist.some((model) => model.id === selected.id)) shortlist.unshift(selected)
  return shortlist
}
