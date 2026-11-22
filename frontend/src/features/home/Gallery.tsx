import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ProductImage } from '@/components/ProductImage'
import { useProducts } from '@/hooks/useCatalog'
import { cx } from '@/lib/cx'

/** Food gallery built from the menu's own photos; hidden until there are enough. */
export function Gallery() {
  const { t } = useTranslation()
  const { data: products } = useProducts()
  const photos = (products ?? [])
    .filter((product) => product.image && !product.is_featured)
    .slice(0, 5)
  if (photos.length < 3) return null

  return (
    <section
      aria-labelledby="gallery-title"
      className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"
    >
      <h2 id="gallery-title" className="font-display text-4xl sm:text-5xl">
        {t('home.galleryTitle')}
      </h2>
      <ul className="mt-10 grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] md:grid-cols-4">
        {photos.map((product, index) => (
          <li key={product.id} className={cx(index === 0 && 'col-span-2 row-span-2')}>
            <Link
              to={`/menu/${product.slug}`}
              className="group relative block h-full overflow-hidden rounded-2xl"
            >
              <ProductImage
                src={product.image}
                alt={product.name}
                sizes={
                  index === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'
                }
                className="h-full w-full transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-3 text-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {product.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
