import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './assets/scss/main.scss'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { useTheme } from './composables/useTheme'
import { router } from './router'

useTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
