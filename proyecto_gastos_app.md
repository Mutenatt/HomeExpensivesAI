# Proyecto: App de Control de Gastos y Presupuestos (Android)

## 📌 Resumen del Proyecto
Aplicación móvil para Android enfocada en el registro ágil de gastos diarios, análisis de inflación (variación de precios) y control de presupuestos. El objetivo es mantener una carga rápida (menos de 3 clics) utilizando autocompletado predictivo.

## 🛠 Stack Tecnológico Seleccionado
*   **Frontend/Cliente:** Aplicación Android (a definir si es Kotlin nativo o framework multiplataforma).
*   **Backend/Base de Datos:** Supabase (PostgreSQL) - Elegido por su facilidad para escalar, crear web apps en el futuro y gestionar lógicas complejas con RLS.
*   **Autenticación:** Supabase Auth.

## 🎯 Funcionalidades Principales (Requerimientos)
1.  **Registro de Gastos Ágil:** Carga rápida pre-completando monto, nombre, tienda, fecha, método de pago y tipo de gasto.
2.  **Gestión de Catálogo (Inflación):** Autocompletado inteligente basado en compras anteriores para normalizar nombres y medir variaciones de precio exactas.
3.  **Manejo de Ingresos:** Registro de ingresos para calcular el margen real (Ingresos - Gastos).
4.  **Balances Automáticos:**
    *   Corte Semanal: Lunes a las 8:00 AM.
    *   Corte Mensual: Día 1 de cada mes.
5.  **Presupuestos Inteligentes:** Etiquetado de artículos como `esencial` al momento de la compra para autocalcular el presupuesto de la canasta básica sin bloqueos mensuales.
6.  **Métodos de Pago Integrados:** 
    *   Billeteras virtuales (ej. MercadoPago).
    *   Transferencias.
    *   Tarjeta de Débito.
    *   Tarjeta de Crédito (con gestión de cuotas a futuro).
    *   Efectivo.

## 📱 UI/UX - Flujo de Carga Rápida (El ciclo de 3 clics)
1.  **Clic 1 (Acción):** Toque en el botón flotante `+ Gasto` desde el Dashboard principal. Se abre un panel inferior con teclado numérico desplegado.
2.  **Clic 2 (Contexto y Autocompletado):** Se ingresa el monto y texto parcial. Al tocar la sugerencia (ej. "Harina 0000" o "Cancha"), la app precarga la tienda habitual y el método de pago más usado para ese rubro.
3.  **Clic 3 (Confirmación):** Botón "Guardar".

## 🗄️ Esquema de Base de Datos (Supabase SQL)

```sql
-- 1. Crear tabla de Productos (Catálogo para autocompletado y variaciones de precio)
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    is_essential BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla de Transacciones (El núcleo de gastos e ingresos)
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    payment_method TEXT NOT NULL,
    store_name TEXT,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Crear tabla de Cuotas (Para proyectar pagos de Tarjetas de Crédito)
CREATE TABLE installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    installment_number INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    amount_per_installment DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Crear Vista (View) para el Historial de Precios
CREATE VIEW price_history AS
SELECT 
    t.id AS transaction_id,
    p.id AS product_id,
    p.name AS product_name,
    t.store_name,
    t.amount AS price,
    t.date
FROM transactions t
JOIN products p ON t.product_id = p.id
WHERE t.type = 'expense';

-- Habilitar la Seguridad a Nivel de Fila (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Ejemplo general)
CREATE POLICY "Users access own products" ON products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own transactions" ON transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own installments" ON installments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## 🚀 Próximos Pasos Sugeridos para Continuar
1.  **Definir el Stack Front-end:** Decidir la tecnología exacta para Android (Kotlin/Jetpack Compose, React Native, o Flutter).
2.  **Configurar Supabase Edge Functions:** Escribir las funciones CRON para automatizar los reportes del lunes a las 8 AM y el día 1 de cada mes.
3.  **Lógica de Cuotas (Front):** Diseñar la pantalla o el formulario expandido que interceptará cuando el usuario elija "Tarjeta de Crédito" para ingresar la cantidad de cuotas.
