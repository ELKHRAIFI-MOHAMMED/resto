import pytest
from django.urls import reverse

from apps.products.models import Product

pytestmark = pytest.mark.django_db


def test_robots_txt_hides_private_pages_and_points_to_sitemap(client, settings):
    settings.PUBLIC_SITE_URL = "https://resto.example/"

    response = client.get(reverse("robots"))

    body = response.content.decode()
    assert response["Content-Type"].startswith("text/plain")
    assert "Disallow: /admin" in body
    assert "Disallow: /checkout" in body
    assert "Sitemap: https://resto.example/sitemap.xml" in body


def test_sitemap_lists_visible_dishes_with_language_alternates(client, settings, burger, category):
    settings.PUBLIC_SITE_URL = "https://resto.example"
    Product.objects.create(category=category, name_fr="Caché", price="10", is_active=False)

    response = client.get(reverse("sitemap"))

    body = response.content.decode()
    assert response["Content-Type"].startswith("application/xml")
    assert "<loc>https://resto.example/</loc>" in body
    assert "<loc>https://resto.example/menu</loc>" in body
    assert f"<loc>https://resto.example/menu/{burger.slug}</loc>" in body
    assert 'hreflang="ar" href="https://resto.example/menu?lang=ar"' in body
    assert "cache" not in body.lower()  # hidden product's slug starts with "cache"
    assert response["Cache-Control"] == "public, max-age=3600"
