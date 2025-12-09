import { ProductForm } from "./product-form"

export default function NewProductPage() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cadastro de Produto</h1>
                    <p className="text-muted-foreground mt-1">
                        Adicione novos produtos ao catálogo, defina preços e gerencie o estoque.
                    </p>
                </div>
            </div>

            <div className="h-4" /> {/* Spacer */}

            <ProductForm />
        </div>
    )
}
