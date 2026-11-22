"""
Root URL configuration.

Layout:
    /api/...            REST API (public + /api/admin/ endpoints, added in Phase 2)
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

api_patterns = [
    path("", include("apps.core.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

urlpatterns = [
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path("api/", include(api_patterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
