import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './chainsaw.css'
const app = createApp(App)
app.config.errorHandler = error => {
  const node = document.createElement('div'); node.className = 'fatal-error'; node.setAttribute('role','alert'); node.textContent = error.message; document.body.append(node)
}
window.addEventListener('error', event => {
  if (event.target?.dataset?.cfsmRetryable === 'turnstile') return
  if (event.target !== window) {
    const node = document.createElement('div'); node.className='fatal-error'; node.textContent=`Resource failed: ${event.target.src || event.target.href || event.message}`; document.body.append(node)
  }
}, true)
app.use(router).mount('#app')
