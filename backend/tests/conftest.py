from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.categories.models import Category
from apps.delivery.models import DeliveryZone
from apps.products.models import Addon, Product, ProductVariant
from apps.restaurant.models import Restaurant

D = Decimal
PASSWORD = "a-strong-test-password"


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


# --- Users -------------------------------------------------------------------


@pytest.fixture
def admin_user(django_user_model):
    return django_user_model.objects.create_superuser(email="owner@example.com", password=PASSWORD)


@pytest.fixture
def manager_user(django_user_model):
    return django_user_model.objects.create_user(
        email="manager@example.com", password=PASSWORD, is_staff=True, role=User.Role.MANAGER
    )


@pytest.fixture
def owner_client(admin_user) -> APIClient:
    client = APIClient()
    client.force_login(admin_user)
    return client


@pytest.fixture
def manager_client(manager_user) -> APIClient:
    client = APIClient()
    client.force_login(manager_user)
    return client


# --- Catalog -----------------------------------------------------------------


@pytest.fixture
def restaurant(db) -> Restaurant:
    restaurant = Restaurant.load()
    restaurant.name = "Test Resto"
    restaurant.whatsapp_number = "212600000000"
    restaurant.minimum_order_amount = D("0")
    restaurant.save()
    return restaurant


@pytest.fixture
def category(db) -> Category:
    return Category.objects.create(name_fr="Burgers", name_ar="برغر", name_en="Burgers")


@pytest.fixture
def cheese(db) -> Addon:
    return Addon.objects.create(name_fr="Fromage", name_ar="جبن", name_en="Cheese", price=D("8.00"))


@pytest.fixture
def bacon(db) -> Addon:
    return Addon.objects.create(name_fr="Bacon", price=D("12.50"))


@pytest.fixture
def burger(category, cheese, bacon) -> Product:
    product = Product.objects.create(
        category=category,
        name_fr="Burger classique",
        name_ar="برغر كلاسيكي",
        name_en="Classic burger",
        price=D("50.00"),
    )
    product.addons.set([cheese, bacon])
    return product


@pytest.fixture
def pizza(category) -> Product:
    product = Product.objects.create(category=category, name_fr="Pizza", price=D("60.00"))
    ProductVariant.objects.create(product=product, name_fr="Moyenne", name_en="Medium")
    ProductVariant.objects.create(
        product=product, name_fr="Grande", name_en="Large", price_delta=D("25.00")
    )
    return product


@pytest.fixture
def zone(db) -> DeliveryZone:
    return DeliveryZone.objects.create(
        name_fr="Maârif", name_ar="المعاريف", delivery_fee=D("15.00"), minimum_order_amount=D("0")
    )


def make_image(name="photo.png", size=(10, 10), fmt="PNG") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", size, color=(200, 155, 92)).save(buffer, format=fmt)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f"image/{fmt.lower()}")
