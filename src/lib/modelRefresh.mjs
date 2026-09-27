// Background discovery must never reset an edited model, key or provider.
export function reconcileModelCatalog(settings, requestedProvider, models) {
  if (!settings || settings.provider !== requestedProvider) return settings
  const selected = models.find(model => model.id === settings.model)
  if (!selected) return settings
  return {
    ...settings,
    input_price: selected.input_price ?? 0,
    cached_input_price: selected.cached_input_price ?? 0,
    output_price: selected.output_price ?? 0,
    currency: 'CNY',
    pricing_source: selected.pricing_source || '供应商未提供',
  }
}
