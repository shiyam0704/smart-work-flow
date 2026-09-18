-- Inventory Item Category Management Migration
-- Enhances public.stock_categories and links public.stock_items with category_id foreign key

-- 1. Ensure stock_categories has description, is_active, updated_at
ALTER TABLE public.stock_categories 
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Case-insensitive unique constraint per company for category name
CREATE UNIQUE INDEX IF NOT EXISTS stock_categories_company_lower_name_idx 
  ON public.stock_categories (company_id, lower(trim(name)));

-- 3. Add category_id to stock_items referencing stock_categories(id)
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.stock_categories(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS stock_items_category_id_idx ON public.stock_items(category_id);
CREATE INDEX IF NOT EXISTS stock_categories_company_idx ON public.stock_categories(company_id);

-- 5. Backfill category_id for existing items where category text matches an existing category name
UPDATE public.stock_items i
SET category_id = c.id
FROM public.stock_categories c
WHERE i.company_id = c.company_id 
  AND lower(trim(i.category)) = lower(trim(c.name))
  AND i.category_id IS NULL;

-- 6. Trigger for updated_at on stock_categories
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_stock_categories_updated_at ON public.stock_categories;
  CREATE TRIGGER trg_stock_categories_updated_at 
    BEFORE UPDATE ON public.stock_categories 
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 7. Ensure RLS policies allow executive or above to insert/update categories
DROP POLICY IF EXISTS "stock_categories exec insert" ON public.stock_categories;
CREATE POLICY "stock_categories exec insert" ON public.stock_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin(auth.uid())
    OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  );

DROP POLICY IF EXISTS "stock_categories exec update" ON public.stock_categories;
CREATE POLICY "stock_categories exec update" ON public.stock_categories
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  )
  WITH CHECK (
    private.is_super_admin(auth.uid())
    OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  );
