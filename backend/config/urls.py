"""
Root URL configuration.

Layout:
    /api/...            public REST API (catalog, restaurant, delivery, orders)
    /api/auth/...       admin session authentication
    /api/admin/...      back-office API (staff only), see config/admin_api.py
    /api/schema/        OpenAPI 3 schema
    /api/docs/          Swagger UI
    /<DJANGO_ADMIN_URL> Django's built-in admin (kept off /admin/, which belongs
                        to the React dashboard)
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.seo import robots_txt, sitemap_xml

api_patterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("restaurant/", include("apps.restaurant.urls")),
    path("categories/", include("apps.categories.urls")),
    path("products/", include("apps.products.urls")),
    path("offers/", include("apps.offers.urls")),
    path("delivery/", include("apps.delivery.urls")),
    path("orders/", include("apps.orders.urls")),
    path("admin/", include("config.admin_api")),
    path("courier/", include("apps.orders.courier_urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

urlpatterns = [
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path("api/", include(api_patterns)),
    path("robots.txt", robots_txt, name="robots"),
    path("sitemap.xml", sitemap_xml, name="sitemap"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
