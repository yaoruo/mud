export interface Position {
  x: number;
  y: number;
}

export interface Exit {
  direction: string;
  destination: string;
}

export interface Room {
  id: string;
  name: string;
  title: string;
  description: string;
  exits: Exit[];
  x: number;
  y: number;
  tags: string[];
  [key: string]: any; // 用于自定义属性
}

export interface Template {
  name: string;
  room: Partial<Room>;
}

export interface AttributeTemplate {
  id: string;
  name: string;
}

export interface Direction {
  value: string;
  label: string;
  icon?: any;
  dx: number;
  dy: number;
}
