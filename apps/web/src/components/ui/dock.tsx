"use client"

import React, { PropsWithChildren, useEffect, useRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  iconSize?: number
  iconMagnification?: number
  disableMagnification?: boolean
  iconDistance?: number
  direction?: "top" | "middle" | "bottom"
  children: React.ReactNode
}

const DEFAULT_SIZE = 40
const DEFAULT_MAGNIFICATION = 60
const DEFAULT_DISTANCE = 140
const DEFAULT_DISABLEMAGNIFICATION = false

const dockVariants = cva(
  "mx-auto mt-8 flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md shadow-sm bg-white/55 dark:bg-white/10 border-white/30 dark:border-white/15 supports-backdrop-blur:bg-white/45 supports-backdrop-blur:dark:bg-white/10"
)

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = "middle",
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity)

    const renderChildren = () => {
      return React.Children.map(children, (child) => {
        if (
          React.isValidElement<DockIconProps>(child) &&
          child.type === DockIcon
        ) {
          return React.cloneElement(child, {
            ...child.props,
            mouseX: mouseX,
            size: iconSize,
            magnification: iconMagnification,
            disableMagnification: disableMagnification,
            distance: iconDistance,
          })
        }
        return child
      })
    }

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        {...props}
        className={cn(dockVariants({ className }), {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {renderChildren()}
      </motion.div>
    )
  }
)

Dock.displayName = "Dock"

export interface DockIconProps extends Omit<
  MotionProps & React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  size?: number
  magnification?: number
  disableMagnification?: boolean
  distance?: number
  mouseX?: MotionValue<number>
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = ({
  size = DEFAULT_SIZE,
  magnification = DEFAULT_MAGNIFICATION,
  disableMagnification,
  distance = DEFAULT_DISTANCE,
  mouseX,
  className,
  children,
  onHoverStart,
  onHoverEnd,
  ...props
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const padding = Math.max(6, size * 0.2)
  const defaultMouseX = useMotionValue(Infinity)

  const distanceCalc = useTransform(mouseX ?? defaultMouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })

  const targetSize = disableMagnification ? size : magnification

  const sizeTransform = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [size, targetSize, size]
  )

  const scaleSize = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })

  // Background redondo do item sob hover (somente no item realmente em hover)
  const bgOpacityTarget = useMotionValue(0)
  const bgOpacity = useSpring(bgOpacityTarget, {
    mass: 0.12,
    stiffness: 180,
    damping: 16,
  })

  const dataActive = (props as { "data-active"?: string })["data-active"]
  const isActive = dataActive === "true"

  // Se o item virar ativo enquanto o mouse ainda está em cima (após clique),
  // remove o halo de hover para não somar com o background do ativo.
  useEffect(() => {
    if (isActive || disableMagnification) {
      bgOpacityTarget.set(0)
    }
  }, [isActive, disableMagnification, bgOpacityTarget])

  return (
    <motion.div
      ref={ref}
      style={{ width: scaleSize, height: scaleSize, padding }}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center rounded-full transition-[background-color,box-shadow,color] duration-200 ease-out",
        disableMagnification && "hover:bg-muted-foreground transition-colors",
        className
      )}
      onHoverStart={(event, info) => {
        if (!disableMagnification && !isActive) {
          bgOpacityTarget.set(0.32)
        }
        onHoverStart?.(event, info)
      }}
      onHoverEnd={(event, info) => {
        bgOpacityTarget.set(0)
        onHoverEnd?.(event, info)
      }}
      {...props}
    >
      {!disableMagnification && !isActive && (
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/20 dark:bg-white/18"
          style={{ opacity: bgOpacity }}
        />
      )}
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        {children}
      </div>
    </motion.div>
  )
}

DockIcon.displayName = "DockIcon"

export { Dock, DockIcon, dockVariants }
