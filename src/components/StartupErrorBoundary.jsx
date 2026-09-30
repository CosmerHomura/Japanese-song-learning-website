import { Component } from 'react'

export default class StartupErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) { return { error } }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="startup-error" role="alert">
      <h1>无法安全读取本机学习数据</h1>
      <p>{this.state.error.message || '启动时发生错误。'}</p>
      <p>应用没有清除你的本地记录。请先备份应用数据，再更新到兼容版本。</p>
    </main>
  }
}
