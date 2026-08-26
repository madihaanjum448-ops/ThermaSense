import pythermalcomfort
from pythermalcomfort.models import utci, wbgt, heat_index_rothfusz
import inspect

print("utci signature:", inspect.signature(utci))
print("wbgt signature:", inspect.signature(wbgt))
print("heat_index_rothfusz signature:", inspect.signature(heat_index_rothfusz))
