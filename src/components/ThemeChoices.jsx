export default function ThemeChoices({ preferences, onChange }) {
  return <fieldset className="theme-choices"><legend>界面主题</legend><div>
    {[['paper', '暖纸', '柔和米白'], ['mint', '清新绿', '清爽浅绿'], ['night', '夜读', '低亮深色']].map(([id, label, description]) =>
      <button key={id} type="button" data-theme-choice={id} aria-pressed={(preferences.theme || 'paper') === id}
        onClick={() => onChange({ ...preferences, theme: id })}>
        <span className={`theme-swatch theme-swatch-${id}`} aria-hidden="true"><i /><i /><i /></span>
        <b>{label}</b><small>{description}</small>
      </button>)}
  </div></fieldset>
}
