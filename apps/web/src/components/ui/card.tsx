import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-lg border bg-card text-card-foreground shadow-sm",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        // p-6 custa 48px de largura por nível de card, e isso empilha em cards
        // aninhados. A redução vai em max-sm: de propósito — com sm: o padrão
        // vira uma media query que VENCE o className sem prefixo do call site
        // (o DataTable passa "py-4 px-4") e o desktop quebra. Em max-sm: as
        // regras não existem de sm para cima, então o desktop fica intacto.
        className={cn(
            "flex flex-col space-y-1.5 px-6 pt-6 pb-3 max-sm:px-4 max-sm:pt-4",
            className
        )}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-2xl font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        // O pt-0 fica SEM prefixo de propósito: assim um call site que passa
        // "p-4"/"py-4" o sobrepõe normalmente (mesmo grupo, vence o último).
        // Um max-sm:pt-0 sobreviveria como media query e zeraria o topo do card
        // no celular, que foi exatamente o bug espelhado do desktop.
        className={cn("p-6 pt-0 max-sm:px-4 max-sm:pb-4", className)}
        {...props}
    />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex items-center p-6 pt-0 max-sm:px-4 max-sm:pb-4",
            className
        )}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
