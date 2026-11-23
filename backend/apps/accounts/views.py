"""
Session authentication for the admin dashboard.

Flow: GET /api/auth/csrf/ (sets the csrftoken cookie) → POST /api/auth/login/
with the X-CSRFToken header → the HttpOnly session cookie authenticates later
requests. Login is CSRF-protected and rate limited.
"""

from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsStaffOrCourier

from .serializers import LoginSerializer, UserSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(tags=["auth"], summary="Set the CSRF cookie", responses={204: None})
    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    # DRF only enforces CSRF for authenticated sessions; csrf_protect also
    # covers this anonymous request, preventing login CSRF.
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        tags=["auth"], summary="Log in", request=LoginSerializer, responses=UserSerializer
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)  # rotates the session key
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsStaffOrCourier]

    @extend_schema(tags=["auth"], summary="Log out", request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsStaffOrCourier]

    @extend_schema(tags=["auth"], summary="Current user", responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)
