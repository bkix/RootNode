declare module '*.png' {
  const src: string
  export default src
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.css' {}

declare module 'virtual:deps' {
  export const appVersion: string
  export const deps: { name: string; version: string }[]
}
