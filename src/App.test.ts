import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '@/App.vue'

describe('App', () => {
  it('muestra el nombre de la aplicación', () => {
    expect(mount(App).text()).toContain('Rendiciones Heca')
  })
})
