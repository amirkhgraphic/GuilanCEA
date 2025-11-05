"""Configuration for Django location fields backed by OpenStreetMap."""

DEFAULT_MAP_CENTER = [37.0629098, 50.4232464]

LOCATION_FIELD = {
    'map.provider': 'openstreetmap',
    'map.zoom': 13,
    'map.center': DEFAULT_MAP_CENTER,
    'map.language': 'fa',
    'search.provider': 'nominatim',
    'search.url': 'https://nominatim.openstreetmap.org/search/',
    'search.params': {'format': 'json', 'addressdetails': 1},
    'search.headers': {'User-Agent': 'Django CS Association App'},
}
