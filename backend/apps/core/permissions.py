from rest_framework.permissions import BasePermission


class IsStaff(BasePermission):
    """Active back-office user (owner or manager)."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.is_staff)


class IsCourier(BasePermission):
    """Active courier with a courier profile (delivery app)."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.is_courier
            and hasattr(user, "courier")
        )


class IsStaffOrCourier(BasePermission):
    def has_permission(self, request, view) -> bool:
        return IsStaff().has_permission(request, view) or IsCourier().has_permission(request, view)


class IsOwner(IsStaff):
    """Restaurant owner: required for restaurant-wide settings."""

    def has_permission(self, request, view) -> bool:
        return super().has_permission(request, view) and request.user.is_owner
