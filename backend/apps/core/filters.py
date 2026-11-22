from rest_framework.filters import OrderingFilter


class AliasedOrderingFilter(OrderingFilter):
    """
    OrderingFilter whose public names map to queryset expressions, declared on
    the view as `ordering_aliases = {"price": "current_price"}`.
    """

    def get_valid_fields(self, queryset, view, context=None):
        aliases = getattr(view, "ordering_aliases", {})
        return [(alias, alias) for alias in aliases]

    def get_ordering(self, request, queryset, view):
        params = request.query_params.get(self.ordering_param)
        if not params:
            return None  # keep the queryset's own default ordering
        ordering = self.remove_invalid_fields(
            queryset, [term.strip() for term in params.split(",")], view, request
        )
        if not ordering:
            return None
        aliases = view.ordering_aliases
        return [
            f"-{aliases[term[1:]]}" if term.startswith("-") else aliases[term] for term in ordering
        ]
