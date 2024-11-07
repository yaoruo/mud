'use client'

import { Room, Template, Exit, Position, Direction, AttributeTemplate } from './types'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Move, Trash2, Copy, Search, Undo, Redo, Save, FileUp, FileDown, Image, Tag, X } from 'lucide-react'
import JSZip from 'jszip'
import html2canvas from 'html2canvas'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

type Exit = {
  direction: string
  destination: string
}

type Room = {
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

type Template = {
  name: string
  room: Omit<Room, 'id' | 'x' | 'y'>
}

const directions = [
  { value: 'northwest', label: '西北', icon: ArrowUp, dx: -1, dy: -1 },
  { value: 'north', label: '北', icon: ArrowUp, dx: 0, dy: -1 },
  { value: 'northeast', label: '东北', icon: ArrowUp, dx: 1, dy: -1 },
  { value: 'west', label: '西', icon: ArrowLeft, dx: -1, dy: 0 },
  { value: 'center', label: '中心', icon: null, dx: 0, dy: 0 },
  { value: 'east', label: '东', icon: ArrowRight, dx: 1, dy: 0 },
  { value: 'southwest', label: '西南', icon: ArrowDown, dx: -1, dy: 1 },
  { value: 'south', label: '南', icon: ArrowDown, dx: 0, dy: 1 },
  { value: 'southeast', label: '东南', icon: ArrowDown, dx: 1, dy: 1 },
]

export default function AdvancedMUDRoomCreator() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 })
  const [history, setHistory] = useState<Room[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [searchTerm, setSearchTerm] = useState('')
  const [newTag, setNewTag] = useState('')
  const [searchResults, setSearchResults] = useState<Room[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>(['/d/city/', '/d/village/', '/d/forest/']);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('/d/city/');
  const mapRef = useRef<HTMLDivElement>(null)
  const [newAttributeId, setNewAttributeId] = useState('');
  const [newAttributeName, setNewAttributeName] = useState('');
  const [attributeTemplates, setAttributeTemplates] = useState<{ id: string; name: string }[]>([
    { id: 'no_fight', name: '禁止战斗' },
    { id: 'fuben', name: '副本地图' },
    { id: 'no_showroom', name: '禁止传送' },
    { id: 'outdoors', name: '室外' },
  ]);

  useEffect(() => {
    const savedRooms = localStorage.getItem('mudRooms')
    const savedTemplates = localStorage.getItem('mudTemplates')
    const savedPrefixes = localStorage.getItem('mudPrefixes')
    if (savedRooms) {
      const parsedRooms = JSON.parse(savedRooms)
      setRooms(parsedRooms)
      setHistory([parsedRooms])
      setHistoryIndex(0)
    }
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates))
    }
    if (savedPrefixes) {
      setPrefixes(JSON.parse(savedPrefixes))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('mudRooms', JSON.stringify(rooms))
  }, [rooms])

  useEffect(() => {
    localStorage.setItem('mudTemplates', JSON.stringify(templates))
  }, [templates])

  useEffect(() => {
    localStorage.setItem('mudPrefixes', JSON.stringify(prefixes))
  }, [prefixes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault()
            undo()
            break
          case 'y':
            e.preventDefault()
            redo()
            break
          case 's':
            e.preventDefault()
            if (currentRoom) saveTemplate()
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentRoom])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (currentRoom) {
      if (e.target.name === 'name') {
        setCurrentRoom({ ...currentRoom, [e.target.name]: selectedPrefix + e.target.value });
      } else {
        setCurrentRoom({ ...currentRoom, [e.target.name]: e.target.value });
      }
    }
  }

  const handleCheckboxChange = (name: string, checked: boolean) => {
    if (currentRoom) {
      const updatedRoom = { ...currentRoom, [name]: checked };
      setCurrentRoom(updatedRoom);
      updateRoom(updatedRoom);
    }
  }

// 修改 handleAddExit 函数
const handleAddExit = (e: React.MouseEvent, direction: string) => {
  e.preventDefault();
  if (!currentRoom || direction === 'center') return

  const dir = directions.find(d => d.value === direction)
  if (!dir) return

  const newX = currentRoom.x + dir.dx
  const newY = currentRoom.y + dir.dy
  const newRoomId = `${newX},${newY}`

  const existingRoom = rooms.find(r => r.x === newX && r.y === newY)
  const newExit: Exit = { 
    direction, 
    // 使用当前选择的前缀来构建目标房间的文件名
    destination: existingRoom ? existingRoom.name : `${selectedPrefix}room_${newRoomId}` 
  }

  const updatedRoom = { ...currentRoom, exits: [...currentRoom.exits, newExit] }
  updateRoom(updatedRoom)
  setCurrentRoom(updatedRoom)
}

  const getOppositeDirection = (direction: string) => {
    const opposites: { [key: string]: string } = {
      'north': 'south',
      'northeast': 'southwest',
      'east': 'west',
      'southeast': 'northwest',
      'south': 'north',
      'southwest': 'northeast',
      'west': 'east',
      'northwest': 'southeast'
    }
    return opposites[direction] || direction
  }

  const updateRoom = (room: Room) => {
    const newRooms = rooms.map(r => r.id === room.id ? room : r);
    setRooms(newRooms);
    addToHistory(newRooms);
  }

  const addRoom = (x: number, y: number) => {
    const newRoom: Room = {
      id: `${x},${y}`,
      name: `room_${x}_${y}`,
      title: `新房间 (${x},${y})`,
      description: '',
      exits: [],
      x,
      y,
      tags: [],
    }
    const newRooms = [...rooms, newRoom]
    setRooms(newRooms)
    setCurrentRoom(newRoom)
    addToHistory(newRooms)
  }

  const deleteRoom = (roomId: string) => {
    const newRooms = rooms.filter(r => r.id !== roomId)
    setRooms(newRooms)
    setCurrentRoom(null)
    addToHistory(newRooms)
  }

  const copyRoom = (room: Room) => {
    const newRoom = {
      ...room,
      id: `${room.x + 1},${room.y + 1}`,
      name: `${room.name}_copy`,
      x: room.x + 1,
      y: room.y + 1,
    }
    const newRooms = [...rooms, newRoom]
    setRooms(newRooms)
    setCurrentRoom(newRoom)
    addToHistory(newRooms)
  }

  const addToHistory = (newRooms: Room[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newRooms)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setRooms(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setRooms(history[historyIndex + 1])
    }
  }

  const saveTemplate = () => {
    if (!currentRoom) return
    const { id, x, y, ...templateRoom } = currentRoom
    const newTemplate: Template = {
      name: `模板_${templates.length + 1}`,
      room: templateRoom
    }
    setTemplates([...templates, newTemplate])
  }

  const loadTemplate = (template: Template) => {
    if (!currentRoom) return
    const updatedRoom = { ...currentRoom, ...template.room }
    setCurrentRoom(updatedRoom)
    updateRoom(updatedRoom)
  }

  const addTag = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentRoom || !newTag) return
    const updatedRoom = { ...currentRoom, tags: [...currentRoom.tags, newTag] }
    setCurrentRoom(updatedRoom)
    updateRoom(updatedRoom)
    setNewTag('')
  }

  const removeTag = (e: React.MouseEvent, tagToRemove: string) => {
    e.preventDefault();
    if (!currentRoom) return
    const updatedRoom = { ...currentRoom, tags: currentRoom.tags.filter(tag => tag !== tagToRemove) }
    setCurrentRoom(updatedRoom)
    updateRoom(updatedRoom)
  }

  const generateRoomCode = (room: Room) => {
    return `// ${room.name}.c
#include <ansi.h>
#include <room.h>

inherit ROOM;

void create()
{
  set("short", "${room.title}");
  set("long", "${room.description}");
  ${attributeTemplates
    .filter(attr => room[attr.id as keyof Room] as boolean)
    .map(attr => `set("${attr.id}", 1);`)
    .join('\n  ')}
  
  set("exits", ([
      ${room.exits.map(exit => `"${exit.direction}" : "${exit.destination}"`).join(',\n        ')}
  ]));

  setup();
}
`
  }

  const handleDownloadAllRooms = (e: React.MouseEvent) => {
    e.preventDefault();
    const zip = new JSZip();
    rooms.forEach(room => {
      const code = generateRoomCode(room);
      zip.file(`${room.name}.c`, code);
    });
    
    const mapData = JSON.stringify({ rooms, attributeTemplates });
    zip.file('map_data.json', mapData);

    zip.generateAsync({ type: "blob" })
    .then(function(content) {
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "mud_rooms.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    })
    .catch(function(error) {
      console.error('下载出错:', error);
      alert('下载文件时出现错误，请重试。');
    });
  };

  const handleMapClick = (x: number, y: number) => {
    const existingRoom = rooms.find(r => r.x === x && r.y === y)
    if (existingRoom) {
      setCurrentRoom(existingRoom)
    } else {
      if (currentRoom?.id === `${x},${y}`) {
        addRoom(x, y)
      } else {
        setCurrentRoom({
          id: `${x},${y}`,
          name: `room_${x}_${y}`,
          title: `新房间 (${x},${y})`,
          description: '',
          exits: [],
          x,
          y,
          tags: [],
        })
      }
    }
  }

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(prev / 1.2, 0.5))
  }

  const exportMapAsImage = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mapRef.current) {
      html2canvas(mapRef.current).then(canvas => {
        const link = document.createElement('a')
        link.download = 'mud_map.png'
        link.href = canvas.toDataURL()
        link.click()
      })
    }
  }

  const handleSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    const results = rooms.filter(room => 
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setSearchResults(results);
  };

  const handleAddPrefix = () => {
    const newPrefix = prompt('请输入新的前缀');
    if (newPrefix && !prefixes.includes(newPrefix)) {
      setPrefixes([...prefixes, newPrefix]);
      setSelectedPrefix(newPrefix);
    }
  };

// 修改 addCustomAttribute 函数
const addCustomAttribute = (e: React.MouseEvent) => {
  e.preventDefault(); // 阻止默认事件
  
  if (newAttributeId && newAttributeName) {
    // 检查属性ID是否已存在
    if (attributeTemplates.some(attr => attr.id === newAttributeId)) {
      alert('属性ID已存在!');
      return;
    }

    // 使用函数式更新来确保状态更新正确
    setAttributeTemplates(prev => [...prev, { 
      id: newAttributeId, 
      name: newAttributeName 
    }]);

    // 清空输入框
    setNewAttributeId('');
    setNewAttributeName('');
  }
};

// 修改属性勾选处理函数
const handleCustomAttributeChange = (id: string, checked: boolean) => {
  if (currentRoom) {
    const updatedRoom = { 
      ...currentRoom,
      [id]: checked 
    };
    
    // 使用函数式更新
    setCurrentRoom(prev => ({
      ...prev!,
      [id]: checked
    }));
    
    // 更新房间数据
    const newRooms = rooms.map(r => 
      r.id === currentRoom.id ? updatedRoom : r
    );
    setRooms(newRooms);
    addToHistory(newRooms);
  }
};

  const importMap = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importedData = JSON.parse(content);
          setRooms(importedData.rooms);
          setAttributeTemplates(importedData.attributeTemplates);
          addToHistory(importedData.rooms);
          setCurrentRoom(null); // 重置当前选中的房间
          setOffset({ x: 0, y: 0 }); // 重置地图位置
          setScale(1); // 重置缩放
          alert('地图导入成功！');
        } catch (error) {
          console.error('导入失败:', error);
          alert('导入失败，请检查文件格式。');
        }
      };
      reader.readAsText(file);
    }
  };

// 修改 handleWheel 函数
const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
  // 阻止事件冒泡和默认行为
  e.stopPropagation();
  e.preventDefault();
  
  const delta = e.deltaY;
  
  setScale(prevScale => {
    const newScale = delta > 0 
      ? Math.max(prevScale / 1.1, 0.1)  // 缩小
      : Math.min(prevScale * 1.1, 5)     // 放大
    return newScale;
  });
  
  return false; // 确保不会触发页面滚动
}

const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  // 阻止默认行为
  e.preventDefault();
  e.stopPropagation();
  
  // 使用左键拖动
  if (e.button === 0) {
    setIsDragging(true)
    setStartDragPos({ x: e.clientX, y: e.clientY })
  }
}

const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  if (!isDragging) return

  const dx = e.clientX - startDragPos.x
  const dy = e.clientY - startDragPos.y

  setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  setStartDragPos({ x: e.clientX, y: e.clientY })
}

const gridContent = useMemo(() => {
  const gridSize = 20
  const cellSize = 150  // 增加单元格大小到150px
  const grid = []
  
  for (let y = -Math.floor(gridSize/2); y <= Math.floor(gridSize/2); y++) {
    for (let x = -Math.floor(gridSize/2); x <= Math.floor(gridSize/2); x++) {
      const room = rooms.find(r => r.x === x && r.y === y)
      grid.push(
        <div
          key={`${x},${y}`}
          className={`absolute w-36 h-36 border ${
            room ? 'bg-white' : 'bg-gray-100'
          } ${
            currentRoom?.id === `${x},${y}` ? 'border-red-500' : 'border-gray-300'
          } flex items-center justify-center cursor-pointer text-center text-sm`}
          style={{
            left: `${x * cellSize}px`,
            top: `${y * cellSize}px`,
          }}
          onClick={() => handleMapClick(x, y)}
        >
          {room ? room.title : `(${x},${y})`}
          {room && room.exits.map(exit => {
            const dir = directions.find(d => d.value === exit.direction)
            if (!dir) return null
            return (
              <div
                key={exit.direction}
                className="absolute w-4 h-4 bg-green-500"
                style={{
                  left: dir.dx * 75 + 60 + 'px',  // 调整出口指示器位置
                  top: dir.dy * 75 + 60 + 'px',   // 调整出口指示器位置
                }}
              />
            )
          })}
        </div>
      )
    }
  }
  return grid
}, [rooms, currentRoom, handleMapClick])

  const renderExitButtons = () => {
    return (
      <div className="grid grid-cols-3 gap-2">
        {directions.map((dir) => (
          <Button
            key={dir.value}
            variant="outline"
            className="w-full"
            onClick={(e) => handleAddExit(e, dir.value)}
            disabled={dir.value === 'center'}
          >
            {dir.icon && <dir.icon className="mr-2 h-4 w-4" />}
            {dir.label}
          </Button>
        ))}
      </div>
    )
  }

  const clearAllRooms = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 清空所有状态
    setRooms([]); // 清空房间数组
    setCurrentRoom(null); // 清空当前选中的房间
    setSearchResults([]); // 清空搜索结果
    
    // 重置历史记录
    const emptyHistory: Room[][] = [[]];
    setHistory(emptyHistory);
    setHistoryIndex(0);
    
    // 重置视图状态
    setOffset({ x: 0, y: 0 });
    setScale(1);
    
    // 立即清除本地存储
    try {
      localStorage.clear(); // 清除所有存储
      // 或者只清除特定的存储项
      localStorage.removeItem('mudRooms');
      localStorage.removeItem('mudTemplates');
    } catch (error) {
      console.error('清除存储失败:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">高级MUD房间创建器</h1>
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="搜索房间..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSearch}>搜索</Button>
        </div>
        {searchResults.length > 0 && (
          <div className="bg-white p-2 rounded shadow">
            <h3 className="font-bold mb-2">搜索结果：</h3>
            <ul>
              {searchResults.map(room => (
                <li key={room.id} className="cursor-pointer hover:bg-gray-100 p-1" onClick={() => setCurrentRoom(room)}>
                  {room.title} ({room.name})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex gap-4 mb-4">
        <Button onClick={(e) => {e.preventDefault(); undo()}} disabled={historyIndex <= 0}><Undo className="mr-2 h-4 w-4" />撤销 (Ctrl+Z)</Button>
        <Button onClick={(e) => {e.preventDefault(); redo()}} disabled={historyIndex >= history.length - 1}><Redo className="mr-2 h-4 w-4" />重做 (Ctrl+Y)</Button>
        <Button onClick={handleDownloadAllRooms}><FileDown className="mr-2 h-4 w-4" />下载所有房间文件</Button>
        <label htmlFor="import-map" className="cursor-pointer">
          <Input
            id="import-map"
            type="file"
            className="hidden"
            onChange={importMap}
            accept=".json"
          />
<Button asChild onClick={() => document.getElementById('import-map')?.click()}>
  <span>
    <FileUp className="mr-2 h-4 w-4" />导入地图
  </span>
</Button>
        </label>
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">
      <Trash2 className="mr-2 h-4 w-4" />清空所有房间
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认清空所有房间</AlertDialogTitle>
      <AlertDialogDescription>
        此操作将删除所有已创建的房间。此操作不可撤销。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction 
        onClick={(e) => {
          clearAllRooms(e);
          // 强制刷新组件
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }}
      >
        确认清空
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
        <Button onClick={(e) => exportMapAsImage(e)}><Image className="mr-2 h-4 w-4" />导出地图为图片</Button>
      </div>
      <div className="flex gap-4">
        <div className="w-2/3">
          <Card className="mb-4">
            <CardContent>
              <div 
    ref={mapRef}
    className="relative w-full h-[600px] overflow-hidden cursor-move"
    onMouseDown={handleMouseDown}
    onMouseMove={handleMouseMove}
    onMouseUp={() => setIsDragging(false)}
    onMouseLeave={() => setIsDragging(false)}
    onWheel={handleWheel}
    onContextMenu={(e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }}
    style={{
      touchAction: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      overscrollBehavior: 'none', // 防止滚动溢出
      overflowAnchor: 'none',     // 防止滚动锚定
    }}
  >
    <div 
      className="absolute left-1/2 top-1/2"
      style={{
        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: 'center',
        transition: 'transform 0.1s ease-out',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        overscrollBehavior: 'none',
        overflowAnchor: 'none',
      }}
    >
      {gridContent}
    </div>
  </div>
              <div className="flex justify-center mt-2 space-x-2">
                <Button onClick={handleZoomIn}>放大</Button>
                <Button onClick={handleZoomOut}>缩小</Button>
                <Button onClick={() => setOffset({ x: 0, y: 0 })}>重置位置</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="w-1/3">
          <Tabs defaultValue="edit">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">编辑房间</TabsTrigger>
              <TabsTrigger value="templates">房间模板</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <Card>
                <CardContent>
                  {currentRoom ? (
                    <form className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">房间文件名</Label>
                        <div className="flex space-x-2">
                          <Select value={selectedPrefix} onValueChange={(value) => {
                            if (value === 'add') {
                              handleAddPrefix();
                            } else {
                              setSelectedPrefix(value);
                            }
                          }}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="选择前缀" />
                            </SelectTrigger>
                            <SelectContent>
                              {prefixes.map((prefix) => (
                                <SelectItem key={prefix} value={prefix}>
                                  {prefix}
                                </SelectItem>
                              ))}
                              <SelectItem value="add">添加新前缀...</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input 
                            id="name" 
                            name="name" 
                            value={currentRoom.name.replace(selectedPrefix, '')} 
                            onChange={handleInputChange} 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title">房间标题</Label>
                        <Input id="title" name="title" value={currentRoom.title} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">房间描述</Label>
                        <Textarea id="description" name="description" value={currentRoom.description} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          {attributeTemplates.map(attr => (
                            <div key={attr.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={attr.id}
                                checked={Boolean(currentRoom?.[attr.id as keyof Room])}
                                onCheckedChange={(checked) => {
                                  if (checked !== 'indeterminate') {
                                    handleCustomAttributeChange(attr.id, checked);
                                  }
                                }}
                              />
                              <Label htmlFor={attr.id}>{attr.name}</Label>
                            </div>
                          ))}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>添加新属性</Label>
                          <div className="flex items-center space-x-2">
                            <Input 
                              placeholder="属性ID"
                              value={newAttributeId}
                              onChange={(e) => setNewAttributeId(e.target.value)}
                            />
                            <Input 
                              placeholder="属性名称"
                              value={newAttributeName}
                              onChange={(e) => setNewAttributeName(e.target.value)}
                            />
                            <Button onClick={addCustomAttribute}>添加</Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>出口</Label>
                        {renderExitButtons()}
                      </div>
                      {currentRoom.exits.map((exit, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span>{directions.find(d => d.value === exit.direction)?.label}</span>
                          <Input 
                            value={exit.destination} 
                            onChange={(e) => {
                              const newExits = [...currentRoom.exits]
                              newExits[index].destination = e.target.value
                              setCurrentRoom({...currentRoom, exits: newExits})
                            }}
                          />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.preventDefault();
                              const newExits = currentRoom.exits.filter((_, i) => i !== index);
                              const updatedRoom = {...currentRoom, exits: newExits};
                              setCurrentRoom(updatedRoom);
                              updateRoom(updatedRoom);
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      ))}
                      <div className="space-y-2">
                        <Label>标签</Label>
                        <div className="flex flex-wrap gap-2">
                          {currentRoom.tags.map(tag => (
                            <div key={tag} className="flex items-center bg-blue-100 rounded-full px-3 py-1">
                              <span>{tag}</span>
                              <Button variant="ghost" size="sm" onClick={(e) => removeTag(e, tag)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Input 
                            placeholder="新标签" 
                            value={newTag} 
                            onChange={(e) => setNewTag(e.target.value)}
                          />
                          <Button onClick={addTag}><Tag className="mr-2 h-4 w-4" />添加标签</Button>
                        </div>
                      </div>
                      <Button onClick={(e) => {e.preventDefault(); updateRoom(currentRoom);}}>保存房间</Button>
                      <Button onClick={(e) => {e.preventDefault(); saveTemplate();}}><Save className="mr-2 h-4 w-4" />保存为模板 (Ctrl+S)</Button>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />删除房间</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>确认删除</DialogTitle>
                            </DialogHeader>
                            <p>您确定要删除这个房间吗？此操作不可撤销。</p>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setCurrentRoom(null)}>取消</Button>
                              <Button variant="destructive" onClick={() => deleteRoom(currentRoom.id)}>确认删除</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button onClick={(e) => {e.preventDefault(); copyRoom(currentRoom);}}><Copy className="mr-2 h-4 w-4" />复制房间</Button>
                      </div>
                    </form>
                  ) : (
                    <p>点击地图创建或选择一个房间</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="templates">
              <Card>
                <CardContent>
                  <h2 className="text-xl font-bold mb-4">房间模板</h2>
                  {templates.map((template, index) => (
                    <div key={index} className="mb-2 p-2 border rounded">
                      <h3 className="font-bold">{template.name}</h3>
                      <p>{template.room.title}</p>
                      <Button onClick={() => loadTemplate(template)}>加载模板</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
