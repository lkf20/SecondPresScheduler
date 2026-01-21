// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js server globals
global.Request = class {
  constructor() {}
}

global.Response = class {
  constructor(body, init) {
    this.body = body
    this.status = (init && init.status) || 200
  }

  static json(body, init) {
    return new global.Response(body, init)
  }
}
