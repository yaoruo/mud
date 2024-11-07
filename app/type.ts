export type Exit = {
  direction: string
  destination: string
}

export type Room = {
  id: string
  name: string
  title: string
  description: string
  exits: Exit[]
  x: number
  y: number
  tags: string[]
  [key: string]: boolean | string | Exit[] | number | string[]
}

export type Template = {
  name: string
  room: Omit<Room, 'id' | 'x' | 'y'>
}

export type Position = {
  x: number
  y: number
}

export type Direction = {
  value: string
  label: string
  icon?: any
  dx: number
  dy: number
}

export type AttributeTemplate = {
  id: string
  name: string
}
