# Prompts para los fondos temáticos del modo parqueadero

Mismo flujo que usamos para los autos y los landmarks del selector de
niveles: Recraft.ai → **Create** → dropdown **Ilustración/Arte vectorial**
→ elegí tu estilo personalizado **"salida"** (el mismo que ya usaste) →
pegá el prompt → generá → descargá.

Son **10 imágenes**, una por cada "zona" del selector de niveles (no hace
falta versión de día y de noche por separado — el juego oscurece la
imagen automáticamente de noche con el mismo sistema que ya usa el resto
del juego).

**Guardalas en** `public/assets/parking-backgrounds/` con estos nombres
exactos (el código ya las está esperando, apenas aparezca el archivo se
usa solo, sin tocar código):

```
public/assets/parking-backgrounds/parking-lot.png
public/assets/parking-backgrounds/mall.png
public/assets/parking-backgrounds/casino.png
public/assets/parking-backgrounds/gas-station.png
public/assets/parking-backgrounds/supermarket.png
public/assets/parking-backgrounds/hospital.png
public/assets/parking-backgrounds/police-station.png
public/assets/parking-backgrounds/park.png
public/assets/parking-backgrounds/fast-food.png
public/assets/parking-backgrounds/car-wash.png
```

Si Recraft te deja elegir relación de aspecto, usá la más alta/vertical
disponible (tipo 2:3 o 9:16) — se ve mejor en el teléfono. Si solo tenés
cuadrada, no pasa nada, el juego la recorta automáticamente para cubrir
la pantalla.

**Nota importante para cada prompt**: la mitad inferior-central de la
imagen queda tapada por el tablero del rompecabezas — no hace falta que
esté vacía ni transparente (a diferencia del cockpit), pero conviene que
sea la parte menos "ocupada" de la composición, para que si un nivel
tiene un tablero chico, lo que se alcance a ver ahí no compita
visualmente con los autos. Toda la identidad del lugar (fachada, letrero,
detalles) va mejor concentrada arriba y a los costados.

---

## 1. parking-lot (zona de inicio, niveles 1-4)

```
Top-down bird's-eye view of a plain public parking lot entrance, same
flat-color vector illustration style as the previous set (bold black
outlines, saturated colors, simple cel shading, no gradients). A small
ticket booth and a striped entrance barrier near the top edge, faded
painted lane lines along the side edges. The lower-center two-thirds of
the frame is open, plain gray asphalt pavement with minimal detail.
Portrait orientation, no text, no logos, no people, no cars.
```

## 2. mall (niveles 5-8)

```
Top-down bird's-eye view of a shopping mall entrance, same flat-color
vector illustration style as the previous set (bold black outlines,
saturated colors, simple cel shading). Glass storefront facade with a
covered entrance canopy near the top edge, a couple of potted trees and
a generic blank marquee sign (no readable text) along the side edges.
The lower-center two-thirds of the frame is open, plain light-gray
asphalt pavement with minimal detail. Portrait orientation, no text, no
logos, no people, no cars.
```

## 3. casino (niveles 9-12)

```
Top-down bird's-eye view of a casino entrance, same flat-color vector
illustration style as the previous set (bold black outlines, saturated
colors, simple cel shading). Gold-and-purple domed facade with neon trim
and a red carpet leading from the entrance near the top edge, warm
string lights along the side edges. The lower-center two-thirds of the
frame is open, plain dark asphalt pavement with minimal detail. Portrait
orientation, no text, no logos, no people, no cars.
```

## 4. gas-station (niveles 13-16)

```
Top-down bird's-eye view of a gas station forecourt, same flat-color
vector illustration style as the previous set (bold black outlines,
saturated colors, simple cel shading). A red-and-yellow canopy roof
along the top edge with a blank generic price sign (no readable text),
fuel pump silhouettes tucked along the side edges. The lower-center
two-thirds of the frame is open, plain gray asphalt pavement with subtle
oil-stain details. Portrait orientation, no text, no logos, no people,
no cars.
```

## 5. supermarket (niveles 17-20)

```
Top-down bird's-eye view of a supermarket entrance, same flat-color
vector illustration style as the previous set (bold black outlines,
saturated colors, simple cel shading). Green-and-blue striped awning
over glass sliding doors near the top edge, a cart corral and a couple
of shopping carts along one side edge. The lower-center two-thirds of
the frame is open, plain light-gray asphalt pavement with minimal
detail. Portrait orientation, no text, no logos, no people, no cars.
```

## 6. hospital (niveles 21-24)

```
Top-down bird's-eye view of a hospital entrance, same flat-color vector
illustration style as the previous set (bold black outlines, saturated
colors, simple cel shading). White-and-blue building facade with a large
red cross emblem and a covered ambulance bay near the top edge, a
helipad marking tucked in one corner. The lower-center two-thirds of the
frame is open, plain light-gray asphalt pavement with minimal detail.
Portrait orientation, no text, no logos, no people, no cars.
```

## 7. police-station (niveles 25-28)

```
Top-down bird's-eye view of a police station entrance, same flat-color
vector illustration style as the previous set (bold black outlines,
saturated colors, simple cel shading). Dark blue-and-white building
facade with a flagpole and a generic blank badge emblem (no readable
text) near the top edge, low concrete barriers along one side edge. The
lower-center two-thirds of the frame is open, plain gray asphalt
pavement with minimal detail. Portrait orientation, no text, no logos,
no people, no cars.
```

## 8. park (niveles 29-32)

```
Top-down bird's-eye view of the edge of a public park bordering a small
parking area, same flat-color vector illustration style as the previous
set (bold black outlines, saturated colors, simple cel shading). Leafy
green trees, grass patches, and a park bench along the top and side
edges. The lower-center two-thirds of the frame is open, plain
light-gray asphalt pavement with minimal detail. Portrait orientation,
no text, no logos, no people, no cars.
```

## 9. fast-food (niveles 33-36)

```
Top-down bird's-eye view of a fast-food restaurant with a drive-thru
lane, same flat-color vector illustration style as the previous set
(bold black outlines, saturated colors, simple cel shading). Bright
red-and-yellow building facade near the top edge, a curved drive-thru
lane with a blank generic menu board (no readable text) along one side
edge. The lower-center two-thirds of the frame is open, plain gray
asphalt pavement with minimal detail. Portrait orientation, no text, no
logos, no people, no cars.
```

## 10. car-wash (niveles 37-40, después vuelve a ciclar)

```
Top-down bird's-eye view of a car wash entrance, same flat-color vector
illustration style as the previous set (bold black outlines, saturated
colors, simple cel shading). Blue-and-white building with soap-bubble
motifs and spinning brush rollers visible at the entrance tunnel near
the top edge, a wet glossy pavement sheen along one side edge. The
lower-center two-thirds of the frame is open, plain gray asphalt
pavement with minimal detail. Portrait orientation, no text, no logos,
no people, no cars.
```
