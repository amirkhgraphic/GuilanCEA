# Django Location Field Configuration (for OpenStreetMap)
LOCATION_FIELD = {
    'map.provider': 'openstreetmap',
    'map.zoom': 13,
    'map.center': [37.0629098, 50.4232464], # Default center (e.g., East Guilan University)
    'map.language': 'fa',
    'search.provider': 'nominatim',
    'search.url': 'https://nominatim.openstreetmap.org/search/',
    'search.params': {'format': 'json', 'addressdetails': 1},
    'search.headers': {'User-Agent': 'Django CS Association App'},
}
