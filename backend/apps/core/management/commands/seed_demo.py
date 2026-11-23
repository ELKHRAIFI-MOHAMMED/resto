"""
Load DEMO content for local development: a sample restaurant profile, menu,
add-ons, delivery zones, opening hours and stock photos.

Everything created here is fictional demo data. The WhatsApp number is a
placeholder and must be replaced in the settings before real use. Photos come
from Unsplash (see backend/demo/images/CREDITS.md).
"""

from datetime import time
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.categories.models import Category
from apps.delivery.models import Courier, DeliveryZone
from apps.offers.models import Offer, OfferGroup
from apps.products.models import Addon, Product, ProductImage, ProductVariant
from apps.restaurant.models import OpeningHour, Restaurant

D = Decimal

DEMO_WHATSAPP_NUMBER = "212600000000"  # placeholder, not a real line
DEMO_IMAGES_DIR = Path(settings.BASE_DIR) / "demo" / "images"

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
    "google_maps_url": "https://maps.google.com/?q=Boulevard+d%27Anfa+Casablanca",
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

# slug: ((name fr, ar, en), (description fr, ar, en), display order)
CATEGORIES = {
    "burgers": (
        ("Burgers", "برغر", "Burgers"),
        (
            "Pains briochés et viande hachée chaque matin.",
            "خبز بريوش ولحم مفروم طازج كل صباح.",
            "Brioche buns and beef minced fresh every morning.",
        ),
        1,
    ),
    "tacos": (
        ("Tacos", "تاكوس", "Tacos"),
        (
            "Le tacos à la française, généreux et gratiné.",
            "التاكوس على الطريقة الفرنسية، سخي ومحمّر بالجبن.",
            "French-style tacos, generous and grilled with cheese.",
        ),
        2,
    ),
    "pizzas": (
        ("Pizzas", "بيتزا", "Pizzas"),
        (
            "Pâte maturée 48 h, cuisson au four.",
            "عجينة مخمّرة 48 ساعة، مطهوة في الفرن.",
            "48-hour dough, baked in the oven.",
        ),
        3,
    ),
    "salades": (
        ("Salades", "سلطات", "Salads"),
        ("Fraîches et de saison.", "طازجة وموسمية.", "Fresh and seasonal."),
        4,
    ),
    "desserts": (
        ("Desserts", "حلويات", "Desserts"),
        ("Faits maison chaque jour.", "محضّرة في المطبخ كل يوم.", "Made in house every day."),
        5,
    ),
    "boissons": (
        ("Boissons", "مشروبات", "Drinks"),
        (
            "Fraîches, chaudes et jus pressés.",
            "مشروبات باردة وساخنة وعصائر طبيعية.",
            "Cold drinks, hot drinks and fresh juices.",
        ),
        6,
    ),
}

# Offers (packs): (names, descriptions, price, image, groups)
# group: ((name fr, ar, en), quantity, category slugs whose products can be chosen)
OFFERS = [
    (
        ("Offre Famille", "عرض العائلة", "Family deal"),
        (
            "Trois plats, trois desserts et trois boissons au choix, à partager.",
            "ثلاثة أطباق وثلاث حلويات وثلاثة مشروبات من اختياركم، للمشاركة.",
            "Three mains, three desserts and three drinks of your choice, to share.",
        ),
        D("299.00"),
        "pizza-margherita",
        [
            (("Plats", "الأطباق", "Mains"), 3, ["burgers", "tacos", "pizzas"]),
            (("Desserts", "الحلويات", "Desserts"), 3, ["desserts"]),
            (("Boissons", "المشروبات", "Drinks"), 3, ["boissons"]),
        ],
    ),
    (
        ("Menu Duo", "قائمة الثنائي", "Duo menu"),
        (
            "Deux plats et deux boissons au choix.",
            "طبقان ومشروبان من اختياركم.",
            "Two mains and two drinks of your choice.",
        ),
        D("149.00"),
        "double-cheese-burger",
        [
            (("Plats", "الأطباق", "Mains"), 2, ["burgers", "tacos"]),
            (("Boissons", "المشروبات", "Drinks"), 2, ["boissons"]),
        ],
    ),
]

SIZES_PIZZA = [("Moyenne", "متوسطة", "Medium", D("0")), ("Grande", "كبيرة", "Large", D("25"))]
SIZES_TACOS = [("M", "M", "M", D("0")), ("L", "L", "L", D("15")), ("XL", "XL", "XL", D("30"))]
SIZES_DRINK = [("33 cl", "33 cl", "33 cl", D("0")), ("1 L", "1 L", "1 L", D("10"))]


def product(names, descriptions, price, *, sale=None, featured=False, variants=(), addons=(),
            images=()):  # fmt: skip
    return {
        "names": names,
        "descriptions": descriptions,
        "price": D(price),
        "sale": D(sale) if sale else None,
        "featured": featured,
        "variants": list(variants),
        "addons": list(addons),
        "images": list(images),
    }


# Images live in backend/demo/images. The first is the main image, the
# others go to the product gallery. Products without a matching photo keep
# none: the site shows its designed placeholder instead of a misleading photo.
# fmt: off
PRODUCTS = {
    "burgers": [
        product(("Classic Burger", "برغر كلاسيك", "Classic Burger"),
                ("Bœuf 150 g, cheddar, salade, tomate, oignons rouges, sauce maison.",
                 "لحم بقر 150 غ، جبن شيدر، خس، طماطم، بصل أحمر، صلصة المنزل.",
                 "150 g beef, cheddar, lettuce, tomato, red onion, house sauce."),
                "55", addons=["cheese", "bacon", "egg", "fries"], images=["classic-burger"]),
        product(("Double Cheese Burger", "دبل تشيز برغر", "Double Cheese Burger"),
                ("Deux steaks 120 g, double cheddar fondu, pickles, sauce burger.",
                 "قطعتا لحم 120 غ، شيدر مزدوج ذائب، مخلل، صلصة البرغر.",
                 "Two 120 g patties, double melted cheddar, pickles, burger sauce."),
                "75", sale="65", featured=True, addons=["cheese", "bacon", "egg", "fries"],
                images=["double-cheese-burger"]),
        product(("Chicken Crispy", "دجاج مقرمش", "Crispy Chicken"),
                ("Filet de poulet pané, chou rouge, sauce miel-moutarde.",
                 "فيليه دجاج مقرمش، ملفوف أحمر، صلصة العسل والخردل.",
                 "Breaded chicken fillet, red cabbage, honey-mustard sauce."),
                "58", addons=["cheese", "fries"], images=["chicken-crispy"]),
    ],
    "tacos": [
        product(("Tacos Poulet", "تاكوس دجاج", "Chicken Tacos"),
                ("Poulet mariné, frites, sauce fromagère gratinée.",
                 "دجاج متبّل، بطاطس مقلية، صلصة الجبن المحمّرة.",
                 "Marinated chicken, fries, grilled cheese sauce."),
                "45", featured=True, variants=SIZES_TACOS,
                addons=["cheese", "harissa", "algerian"], images=["tacos-poulet"]),
        product(("Tacos Viande hachée", "تاكوس لحم مفروم", "Minced Beef Tacos"),
                ("Viande hachée épicée, frites, sauce fromagère.",
                 "لحم مفروم متبّل، بطاطس مقلية، صلصة الجبن.",
                 "Spiced minced beef, fries, cheese sauce."),
                "50", variants=SIZES_TACOS, addons=["cheese", "harissa", "algerian"]),
    ],
    "pizzas": [
        product(("Pizza Margherita", "بيتزا مارغريتا", "Margherita Pizza"),
                ("Sauce tomate, mozzarella fior di latte, basilic frais.",
                 "صلصة الطماطم، موزاريلا فيور دي لاتي، ريحان طازج.",
                 "Tomato sauce, fior di latte mozzarella, fresh basil."),
                "60", featured=True, variants=SIZES_PIZZA, addons=["cheese"],
                images=["pizza-margherita"]),
        product(("Pizza Fruits de mer", "بيتزا فواكه البحر", "Seafood Pizza"),
                ("Crevettes, calamars, moules, ail et persil.",
                 "قمرون، كلمار، بلح البحر، ثوم وبقدونس.",
                 "Shrimp, squid, mussels, garlic and parsley."),
                "90", variants=SIZES_PIZZA, addons=["cheese"]),
    ],
    "salades": [
        product(("Salade César", "سلطة سيزر", "Caesar Salad"),
                ("Romaine, poulet grillé, parmesan, croûtons, sauce César.",
                 "خس روماني، دجاج مشوي، بارميزان، خبز محمّص، صلصة سيزر.",
                 "Romaine, grilled chicken, parmesan, croutons, Caesar dressing."),
                "52", addons=["egg"], images=["salade-cesar"]),
        product(("Salade marocaine", "سلطة مغربية", "Moroccan Salad"),
                ("Tomates, concombres, oignons, coriandre, huile d'olive.",
                 "طماطم، خيار، بصل، قزبر، زيت الزيتون.",
                 "Tomatoes, cucumber, onion, coriander, olive oil."),
                "30"),
    ],
    "desserts": [
        product(("Tiramisu maison", "تيراميسو منزلي", "Homemade Tiramisu"),
                ("Mascarpone, café, cacao.", "ماسكاربوني، قهوة، كاكاو.",
                 "Mascarpone, coffee, cocoa."),
                "35", images=["tiramisu", "tiramisu-2"]),
        product(("Pâtisseries marocaines", "حلويات مغربية", "Moroccan Pastries"),
                ("Assortiment du jour aux amandes et au miel, servi avec du thé.",
                 "تشكيلة اليوم باللوز والعسل، تقدّم مع الشاي.",
                 "Today's selection with almonds and honey, served with tea."),
                "32", featured=True,
                images=["patisseries-marocaines", "patisseries-marocaines-2"]),
    ],
    "boissons": [
        product(("Coca-Cola", "كوكا كولا", "Coca-Cola"),
                ("Bien frais, avec glaçons.", "بارد مع مكعبات الثلج.", "Ice cold, with ice."),
                "10", variants=SIZES_DRINK, images=["coca-cola"]),
        product(("Jus d'orange pressé", "عصير برتقال طبيعي", "Fresh Orange Juice"),
                ("Oranges pressées à la commande.", "برتقال يُعصر عند الطلب.",
                 "Oranges squeezed to order."),
                "20", images=["jus-orange"]),
        product(("Thé à la menthe", "أتاي بالنعناع", "Mint Tea"),
                ("Thé vert, menthe fraîche, servi à la marocaine.",
                 "شاي أخضر بالنعناع الطازج، على الطريقة المغربية.",
                 "Green tea and fresh mint, served the Moroccan way."),
                "15", images=["the-menthe", "the-menthe-2"]),
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

# Demo courier accounts (local testing only): (email, first, last, phone, zones)
DEMO_COURIER_PASSWORD = "Demo-Livreur-2026"  # noqa: S105 - demo data, seed refuses to run without DEBUG
COURIERS = [
    ("livreur1@restoflow.local", "Youssef", "Amrani", "0611111111", ["Maârif", "Gauthier", "Anfa"]),
    (
        "livreur2@restoflow.local",
        "Karim",
        "Bennani",
        "0622222222",
        ["Bourgogne", "Aïn Diab", "Sidi Maârouf"],
    ),
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
        parser.add_argument(
            "--no-images", action="store_true", help="Do not attach the demo photos."
        )

    @transaction.atomic
    def handle(self, *args, force: bool = False, no_images: bool = False, **options):
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
        for slug, ((fr, ar, en), (d_fr, d_ar, d_en), order) in CATEGORIES.items():
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name_fr": fr,
                    "name_ar": ar,
                    "name_en": en,
                    "description_fr": d_fr,
                    "description_ar": d_ar,
                    "description_en": d_en,
                    "display_order": order,
                    "is_active": True,
                },
            )
            for position, data in enumerate(PRODUCTS[slug]):
                self._upsert_product(category, position, data, addons, with_images=not no_images)
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

        for order, offer_data in enumerate(OFFERS):
            self._upsert_offer(order, *offer_data, with_images=not no_images)

        for email, first, last, phone, zone_names in COURIERS:
            user = User.objects.filter(email=email).first()
            if user is None:
                user = User.objects.create_user(
                    email=email,
                    password=DEMO_COURIER_PASSWORD,
                    first_name=first,
                    last_name=last,
                    role=User.Role.COURIER,
                    is_staff=False,
                )
            courier, _ = Courier.objects.update_or_create(
                user=user, defaults={"phone": phone, "is_on_duty": True}
            )
            courier.zones.set(DeliveryZone.objects.filter(name_fr__in=zone_names))

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo content loaded: {len(CATEGORIES)} categories, {product_count} products, "
                f"{len(ADDONS)} add-ons, {len(OFFERS)} offers, {len(ZONES)} delivery zones, "
                f"{len(slots)} opening slots, "
                f"{len(COURIERS)} couriers (password {DEMO_COURIER_PASSWORD})."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"WhatsApp number is the placeholder {DEMO_WHATSAPP_NUMBER}: "
                "set the real number in the admin settings."
            )
        )

    @staticmethod
    def _upsert_offer(order, names, descriptions, price, image, groups, *, with_images: bool):
        (fr, ar, en), (d_fr, d_ar, d_en) = names, descriptions
        offer, _ = Offer.objects.update_or_create(
            name_fr=fr,
            defaults={
                "name_ar": ar,
                "name_en": en,
                "description_fr": d_fr,
                "description_ar": d_ar,
                "description_en": d_en,
                "price": price,
                "is_active": True,
                "display_order": order,
            },
        )
        offer.groups.all().delete()
        for position, ((g_fr, g_ar, g_en), quantity, category_slugs) in enumerate(groups):
            group = OfferGroup.objects.create(
                offer=offer,
                name_fr=g_fr,
                name_ar=g_ar,
                name_en=g_en,
                quantity=quantity,
                display_order=position,
            )
            group.products.set(Product.objects.filter(category__slug__in=category_slugs))
        if with_images and not offer.image:
            with (DEMO_IMAGES_DIR / f"{image}.webp").open("rb") as handle:
                offer.image.save(f"{image}.webp", File(handle), save=True)

    def _upsert_product(self, category, position, data, addons, *, with_images: bool) -> None:
        (fr, ar, en), (d_fr, d_ar, d_en) = data["names"], data["descriptions"]
        item, _ = Product.objects.update_or_create(
            category=category,
            name_fr=fr,
            defaults={
                "name_ar": ar,
                "name_en": en,
                "description_fr": d_fr,
                "description_ar": d_ar,
                "description_en": d_en,
                "price": data["price"],
                "sale_price": data["sale"],
                "is_featured": data["featured"],
                "is_active": True,
                "is_available": True,
                "display_order": position,
            },
        )
        item.addons.set([addons[key] for key in data["addons"]])
        for order, (v_fr, v_ar, v_en, delta) in enumerate(data["variants"]):
            ProductVariant.objects.update_or_create(
                product=item,
                name_fr=v_fr,
                defaults={
                    "name_ar": v_ar,
                    "name_en": v_en,
                    "price_delta": delta,
                    "display_order": order,
                },
            )
        if with_images:
            self._attach_images(item, data["images"])

    @staticmethod
    def _attach_images(product: Product, names: list[str]) -> None:
        """Main image + gallery, only when the product has none yet (keeps reruns cheap)."""
        if not names:
            return
        if not product.image:
            with (DEMO_IMAGES_DIR / f"{names[0]}.webp").open("rb") as handle:
                product.image.save(f"{names[0]}.webp", File(handle), save=True)
        if not product.images.exists():
            for position, name in enumerate(names[1:], start=1):
                with (DEMO_IMAGES_DIR / f"{name}.webp").open("rb") as handle:
                    gallery = ProductImage(product=product, display_order=position)
                    gallery.image.save(f"{name}.webp", File(handle), save=True)
