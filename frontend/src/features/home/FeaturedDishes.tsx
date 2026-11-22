import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Price } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { useProducts } from '@/hooks/useCatalog'

export function FeaturedDishes() {
  const { t } = useTranslation()
  const { data: featured } = useProducts({ featured: true })
  if (!featured?.length) return null

  return (
    <section
      aria-labelledby="featured-title"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6"
    >
      <h2 id="featured-title" className="font-display text-4xl sm:text-5xl">
        {t('home.featuredTitle')}
      </h2>
      <ul className="-mx-4 mt-10 flex snap-x scrollbar-none gap-5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {featured.slice(0, 4).map((product) => (
          <li key={product.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
            <Link to={`/menu/${product.slug}`} className="group block">
              <ProductImage
                src={product.image}
                alt={product.name}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 70vw"
                className="aspect-[4/5] w-full rounded-2xl transition-opacity duration-300 group-hover:opacity-85"
              />
              <div className="mt-4 flex items-baseline gap-3">
                <h3 className="flex-1 font-medium group-hover:text-accent">{product.name}</h3>
                <Price
                  amount={product.effective_price}
                  original={product.is_on_sale ? product.price : null}
                  className="text-sm"
                />
              </div>
              <p className="mt-1 text-sm text-muted">{product.category.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
