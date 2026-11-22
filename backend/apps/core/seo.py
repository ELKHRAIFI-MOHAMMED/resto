"""
robots.txt and sitemap.xml for the public site (a single-page app served
from the same domain). Both need absolute URLs, hence PUBLIC_SITE_URL.
"""

from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_GET

from apps.core.i18n import LANGUAGE_CODES
from apps.products.models import Product

PRIVATE_PATHS = ["/admin", "/cart", "/checkout", "/order/", "/api/", "/django-admin/"]


def _site() -> str:
    return settings.PUBLIC_SITE_URL.rstrip("/")


@require_GET
@cache_control(public=True, max_age=3600)
def robots_txt(request):
    lines = ["User-agent: *", *(f"Disallow: {path}" for path in PRIVATE_PATHS), ""]
    lines.append(f"Sitemap: {_site()}/sitemap.xml")
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain; charset=utf-8")


def _url_entry(path: str, lastmod=None) -> str:
    location = escape(f"{_site()}{path}")
    alternates = "".join(
        f'<xhtml:link rel="alternate" hreflang="{code}" href="{location}?lang={code}"/>'
        for code in LANGUAGE_CODES
    )
    alternates += f'<xhtml:link rel="alternate" hreflang="x-default" href="{location}"/>'
    modified = f"<lastmod>{lastmod:%Y-%m-%d}</lastmod>" if lastmod else ""
    return f"<url><loc>{location}</loc>{modified}{alternates}</url>"


@require_GET
@cache_control(public=True, max_age=3600)
def sitemap_xml(request):
    products = (
        Product.objects.filter(is_active=True, category__is_active=True)
        .only("slug", "updated_at")
        .order_by("category__display_order", "display_order", "id")
    )
    entries = [_url_entry("/"), _url_entry("/menu")]
    entries += [_url_entry(f"/menu/{product.slug}", product.updated_at) for product in products]
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">' + "".join(entries) + "</urlset>"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")
