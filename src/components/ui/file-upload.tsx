"use client"

import * as React from "react"
import { Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
    value?: File | null
    onChange?: (file: File | null) => void
    accept?: string
}

export function FileUpload({ className, value, onChange, accept = "image/*", ...props }: FileUploadProps) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [preview, setPreview] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (value) {
            const url = URL.createObjectURL(value)
            setPreview(url)
            return () => URL.revokeObjectURL(url)
        } else {
            setPreview(null)
        }
    }, [value])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        if (onChange) onChange(file)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        const file = e.dataTransfer.files?.[0] || null
        if (file && onChange) onChange(file)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
    }

    return (
        <div
            className={cn(
                "relative flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                className
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => inputRef.current?.click()}
            {...props}
        >
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={accept}
                onChange={handleFileChange}
            />

            {preview ? (
                <div className="relative w-full h-full min-h-[200px] flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-h-[180px] rounded-md object-contain"
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onChange?.(null)
                        }}
                        className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        SVG, PNG, JPG or GIF (MAX. 800x400px)
                    </p>
                </div>
            )}
        </div>
    )
}
