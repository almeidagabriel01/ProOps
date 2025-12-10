"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TextStyle, ImageStyle } from "@/lib/mock-db"
import {
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Palette,
    Type,
    ImageIcon,
    MoveHorizontal
} from "lucide-react"

interface StyleToolbarProps {
    textStyle?: TextStyle
    imageStyle?: ImageStyle
    onTextStyleChange?: (style: TextStyle) => void
    onImageStyleChange?: (style: ImageStyle) => void
    showTextControls?: boolean
    showImageControls?: boolean
}

export function StyleToolbar({
    textStyle = {},
    imageStyle = {},
    onTextStyleChange,
    onImageStyleChange,
    showTextControls = true,
    showImageControls = false
}: StyleToolbarProps) {
    const [showColorPicker, setShowColorPicker] = React.useState(false)

    const updateTextStyle = (updates: Partial<TextStyle>) => {
        onTextStyleChange?.({ ...textStyle, ...updates })
    }

    const updateImageStyle = (updates: Partial<ImageStyle>) => {
        onImageStyleChange?.({ ...imageStyle, ...updates })
    }

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-muted rounded-lg border">
            {showTextControls && (
                <>
                    {/* Font Size */}
                    <div className="flex items-center gap-1 mr-2">
                        <Type className="w-4 h-4 text-muted-foreground" />
                        <select
                            value={textStyle.fontSize || 16}
                            onChange={(e) => updateTextStyle({ fontSize: Number(e.target.value) })}
                            className="h-8 px-2 text-xs bg-background border rounded"
                        >
                            {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(size => (
                                <option key={size} value={size}>{size}px</option>
                            ))}
                        </select>
                    </div>

                    {/* Text Color */}
                    <div className="relative mr-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShowColorPicker(!showColorPicker)}
                        >
                            <Palette className="w-4 h-4" style={{ color: textStyle.color || 'currentColor' }} />
                        </Button>
                        {showColorPicker && (
                            <div
                                className="absolute top-full left-0 mt-1 p-3 bg-popover border rounded-lg shadow-lg z-50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="space-y-2">
                                    <input
                                        type="color"
                                        value={textStyle.color || "#000000"}
                                        onChange={(e) => updateTextStyle({ color: e.target.value })}
                                        className="w-32 h-24 p-0 cursor-pointer border-0"
                                        style={{ appearance: 'auto' }}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                        <Input
                                            type="text"
                                            value={textStyle.color || "#000000"}
                                            onChange={(e) => updateTextStyle({ color: e.target.value })}
                                            className="h-7 text-xs w-20"
                                            placeholder="#000000"
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            onClick={() => setShowColorPicker(false)}
                                        >
                                            OK
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bold, Italic, Underline */}
                    <div className="flex items-center border-l pl-2 mr-2">
                        <Button
                            variant={textStyle.fontWeight === 'bold' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({
                                fontWeight: textStyle.fontWeight === 'bold' ? 'normal' : 'bold'
                            })}
                        >
                            <Bold className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={textStyle.fontStyle === 'italic' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({
                                fontStyle: textStyle.fontStyle === 'italic' ? 'normal' : 'italic'
                            })}
                        >
                            <Italic className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={textStyle.textDecoration === 'underline' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({
                                textDecoration: textStyle.textDecoration === 'underline' ? 'none' : 'underline'
                            })}
                        >
                            <Underline className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Text Alignment */}
                    <div className="flex items-center border-l pl-2">
                        <Button
                            variant={textStyle.textAlign === 'left' || !textStyle.textAlign ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({ textAlign: 'left' })}
                        >
                            <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={textStyle.textAlign === 'center' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({ textAlign: 'center' })}
                        >
                            <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={textStyle.textAlign === 'right' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({ textAlign: 'right' })}
                        >
                            <AlignRight className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={textStyle.textAlign === 'justify' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateTextStyle({ textAlign: 'justify' })}
                        >
                            <AlignJustify className="w-4 h-4" />
                        </Button>
                    </div>
                </>
            )}

            {showImageControls && (
                <>
                    {/* Image Width */}
                    <div className="flex items-center gap-2 mr-2">
                        <MoveHorizontal className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="range"
                            min={25}
                            max={100}
                            step={5}
                            value={imageStyle.width || 100}
                            onChange={(e) => updateImageStyle({ width: Number(e.target.value) })}
                            className="w-24 h-2 accent-primary"
                        />
                        <span className="text-xs text-muted-foreground w-10">
                            {imageStyle.width || 100}%
                        </span>
                    </div>

                    {/* Image Alignment */}
                    <div className="flex items-center border-l pl-2 mr-2">
                        <Button
                            variant={imageStyle.align === 'left' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateImageStyle({ align: 'left' })}
                        >
                            <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={imageStyle.align === 'center' || !imageStyle.align ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateImageStyle({ align: 'center' })}
                        >
                            <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={imageStyle.align === 'right' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateImageStyle({ align: 'right' })}
                        >
                            <AlignRight className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Image Style Options */}
                    <div className="flex items-center border-l pl-2 gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={imageStyle.shadow || false}
                                onChange={(e) => updateImageStyle({ shadow: e.target.checked })}
                                className="rounded"
                            />
                            Sombra
                        </label>
                        <select
                            value={imageStyle.borderRadius || 0}
                            onChange={(e) => updateImageStyle({ borderRadius: Number(e.target.value) })}
                            className="h-8 px-2 text-xs bg-background border rounded"
                        >
                            <option value={0}>Sem borda</option>
                            <option value={4}>Borda pequena</option>
                            <option value={8}>Borda média</option>
                            <option value={16}>Borda grande</option>
                        </select>
                    </div>
                </>
            )}
        </div>
    )
}
