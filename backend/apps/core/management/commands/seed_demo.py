"""
Load DEMO content for local development: a sample restaurant profile, menu,
add-ons, delivery zones and opening hours.

Everything created here is fictional demo data. The WhatsApp number is a
placeholder and must be replaced in the settings before real use.
"""

from datetime import time
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.categories.models import Category
from apps.delivery.models import DeliveryZone
from apps.products.models import Addon, Product, ProductVariant
from apps.restaurant.models import OpeningHour, Restaurant

D = Decimal

DEMO_WHATSAPP_NUMBER = "212600000000"  # placeholder, not a real line

RESTAURANT = {
    "name": "RestoFlow",
    "description_fr": (
        "[Contenu de démonstration] Cuisine généreuse et produits frais, "
        "à déguster sur place, à emporter ou en livraison à Casablanca."
    ),
    "description_ar": (
        "[محتوى تجريبي] مطبخ سخي ومنتجات طازجة، للاستمتاع بها في المطعم أو للطلب "
        "أو التوصيل في الدار البيضاء."
    ),
    "description_en": (
        "[Demo content] Generous cooking with fresh produce, to enjoy in, take away "
        "or have delivered in Casablanca."
    ),
    "address": "12 Boulevard d'Anfa (adresse de démonstration)",
    "city": "Casablanca",
    "phone": "0522000000",
    "whatsapp_number": DEMO_WHATSAPP_NUMBER,
    "email": "contact@restoflow.example",
    "instagram_url": "https://www.instagram.com/",
    "minimum_order_amount": D("60.00"),
    "free_delivery_threshold": D("300.00"),
}

ADDONS = {
    "cheese": ("Supplément fromage", "جبن إضافي", "Extra cheese", D("8.00")),
    "bacon": ("Bacon de bœuf", "بيكون البقر", "Beef bacon", D("12.00")),
    "egg": ("Œuf", "بيضة", "Egg", D("5.00")),
    "harissa": ("Sauce harissa", "صلصة الهريسة", "Harissa sauce", D("3.00")),
    "algerian": ("Sauce algérienne", "الصلصة الجزائرية", "Algerian sauce", D("3.00")),
    "fries": ("Frites maison", "بطاطس مقلية منزلية", "Homemade fries", D("15.00")),
}

# slug: (fr, ar, en, description_fr, order)
CATEGORIES = {
    "burgers": ("Burgers", "برغر", "Burgers", "Pains briochés, viande hachée du jour.", 1),
    "tacos": ("Tacos", "تاكوس", "Tacos", "Le tacos à la française, généreux et gratiné.", 2),
    "pizzas": ("Pizzas", "بيتزا", "Pizzas", "Pâte maturée 48 h, cuisson au four.", 3),
    "salades": ("Salades", "سلطات", "Salads", "Fraîches et de saison.", 4),
    "desserts": ("Desserts", "حلويات", "Desserts", "Faits maison chaque jour.", 5),
    "boissons": ("Boissons", "مشروبات", "Drinks", "Fraîches, chaudes et jus pressés.", 6),
}

SIZES_PIZZA = [("Moyenne", "متوسطة", "Medium", D("0")), ("Grande", "كبيرة", "Large", D("25"))]
SIZES_TACOS = [("M", "M", "M", D("0")), ("L", "L", "L", D("15")), ("XL", "XL", "XL", D("30"))]
SIZES_DRINK = [("33 cl", "33 cl", "33 cl", D("0")), ("1 L", "1 L", "1 L", D("10"))]

# category: [(fr, ar, en, description_fr, price, sale_price, featured, variants, addons)]
# fmt: off
PRODUCTS = {
    "burgers": [
        ("Classic Burger", "برغر كلاسيك", "Classic Burger",
         "Bœuf 150 g, cheddar, salade, tomate, oignons rouges, sauce maison.",
         D("55"), None, True, [], ["cheese", "bacon", "egg", "fries"]),
        ("Double Cheese Burger", "دبل تشيز برغر", "Double Cheese Burger",
         "Deux steaks 120 g, double cheddar fondu, pickles, sauce burger.",
         D("75"), D("65"), True, [], ["cheese", "bacon", "egg", "fries"]),
        ("Chicken Crispy", "دجاج مقرمش", "Crispy Chicken",
         "Filet de poulet pané, coleslaw, sauce miel-moutarde.",
         D("58"), None, False, [], ["cheese", "fries"]),
    ],
    "tacos": [
        ("Tacos Poulet", "تاكوس دجاج", "Chicken Tacos",
         "Poulet mariné, frites, sauce fromagère gratinée.",
         D("45"), None, True, SIZES_TACOS, ["cheese", "harissa", "algerian"]),
        ("Tacos Viande hachée", "تاكوس لحم مفروم", "Minced Beef Tacos",
         "Viande hachée épicée, frites, sauce fromagère.",
         D("50"), None, False, SIZES_TACOS, ["cheese", "harissa", "algerian"]),
    ],
    "pizzas": [
        ("Pizza Margherita", "بيتزا مارغريتا", "Margherita Pizza",
         "Sauce tomate, mozzarella fior di latte, basilic frais.",
         D("60"), None, False, SIZES_PIZZA, ["cheese"]),
        ("Pizza Fruits de mer", "بيتزا فواكه البحر", "Seafood Pizza",
         "Crevettes, calamars, moules, ail et persil.",
         D("90"), None, True, SIZES_PIZZA, ["cheese"]),
    ],
    "salades": [
        ("Salade César", "سلطة سيزر", "Caesar Salad",
         "Romaine, poulet grillé, parmesan, croûtons, sauce César.",
         D("52"), None, False, [], ["egg"]),
        ("Salade marocaine", "سلطة مغربية", "Moroccan Salad",
         "Tomates, concombres, oignons, coriandre, huile d'olive.",
         D("30"), None, False, [], []),
    ],
    "desserts": [
        ("Tiramisu maison", "تيراميسو منزلي", "Homemade Tiramisu",
         "Mascarpone, café, cacao.", D("35"), None, False, [], []),
        ("Pastilla au lait", "بسطيلة بالحليب", "Milk Pastilla",
         "Feuilles croustillantes, crème à la fleur d'oranger, amandes.",
         D("32"), None, True, [], []),
    ],
    "boissons": [
        ("Coca-Cola", "كوكا كولا", "Coca-Cola", "", D("10"), None, False, SIZES_DRINK, []),
        ("Jus d'orange pressé", "عصير برتقال طبيعي", "Fresh Orange Juice",
         "Oranges pressées à la commande.", D("20"), None, False, [], []),
        ("Thé à la menthe", "أتاي بالنعناع", "Mint Tea",
         "Thé vert, menthe fraîche.", D("15"), None, False, [], []),
    ],
}
# fmt: on

# (fr, ar, en, fee, minimum)
ZONES = [
    ("Maârif", "المعاريف", "Maarif", D("15"), D("60")),
    ("Gauthier", "غوتييه", "Gauthier", D("15"), D("60")),
    ("Anfa", "أنفا", "Anfa", D("20"), D("80")),
    ("Bourgogne", "بورغون", "Bourgogne", D("20"), D("80")),
    ("Aïn Diab", "عين الذياب", "Ain Diab", D("25"), D("100")),
    ("Sidi Maârouf", "سيدي معروف", "Sidi Maarouf", D("30"), D("120")),
]

LUNCH = (time(12, 0), time(15, 0))
DINNER = (time(19, 0), time(23, 30))
LATE_DINNER = (time(19, 0), time(1, 0))  # past midnight


class Command(BaseCommand):
    help = "Load DEMO restaurant content for local development (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow running when DEBUG is off. Never use on a real restaurant's data.",
        )

    @transaction.atomic
    def handle(self, *args, force: bool = False, **options):
        if not settings.DEBUG and not force:
            raise CommandError("Refusing to load demo data with DEBUG off (use --force).")

        restaurant = Restaurant.load()
        for field, value in RESTAURANT.items():
            setattr(restaurant, field, value)
        restaurant.save()

        restaurant.opening_hours.all().delete()
        slots = []
        for weekday in range(7):
            dinner = LATE_DINNER if weekday in (4, 5) else DINNER  # Friday, Saturday
            for opens, closes in (LUNCH, dinner):
                slots.append(
                    OpeningHour(
                        restaurant=restaurant, weekday=weekday, opens_at=opens, closes_at=closes
                    )
                )
        OpeningHour.objects.bulk_create(slots)

        addons = {}
        for order, (key, (fr, ar, en, price)) in enumerate(ADDONS.items()):
            addons[key], _ = Addon.objects.update_or_create(
                name_fr=fr,
                defaults={"name_ar": ar, "name_en": en, "price": price, "display_order": order},
            )

        product_count = 0
        for slug, (fr, ar, en, description, order) in CATEGORIES.items():
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name_fr": fr,
                    "name_ar": ar,
                    "name_en": en,
                    "description_fr": description,
                    "display_order": order,
                    "is_active": True,
                },
            )
            for position, row in enumerate(PRODUCTS[slug]):
                p_fr, p_ar, p_en, p_desc, price, sale, featured, variants, addon_keys = row
                product, _ = Product.objects.update_or_create(
                    category=category,
                    name_fr=p_fr,
                    defaults={
                        "name_ar": p_ar,
                        "name_en": p_en,
                        "description_fr": p_desc,
                        "price": price,
                        "sale_price": sale,
                        "is_featured": featured,
                        "is_active": True,
                        "is_available": True,
                        "display_order": position,
                    },
                )
                product.addons.set([addons[key] for key in addon_keys])
                for v_order, (v_fr, v_ar, v_en, delta) in enumerate(variants):
                    ProductVariant.objects.update_or_create(
                        product=product,
                        name_fr=v_fr,
                        defaults={
                            "name_ar": v_ar,
                            "name_en": v_en,
                            "price_delta": delta,
                            "display_order": v_order,
                        },
                    )
                product_count += 1

        for order, (fr, ar, en, fee, minimum) in enumerate(ZONES):
            DeliveryZone.objects.update_or_create(
                name_fr=fr,
                defaults={
                    "name_ar": ar,
                    "name_en": en,
                    "delivery_fee": fee,
                    "minimum_order_amount": minimum,
                    "display_order": order,
                    "is_active": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo content loaded: {len(CATEGORIES)} categories, {product_count} products, "
                f"{len(ADDONS)} add-ons, {len(ZONES)} delivery zones, {len(slots)} opening slots."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"WhatsApp number is the placeholder {DEMO_WHATSAPP_NUMBER}: "
                "set the real number in the admin settings."
            )
        )
