# Новая Горбушка — ТК «Горбушкин Двор»

Багратионовский проезд, 7к3, Москва. Цифровая модель здания для будущей игры.

- `../novaya-gorbushka-3d.html` — 3D-модель: обзор, прогулка от 1-го и 3-го лица, поиск павильона, мини-карта.
- `floor1-scheme.png` — исходная официальная схема 1 этажа (gorbushkin.ru).
- `floor1-model.json` — оцифрованный 1 этаж в метрах (данные для игры).
- `floor1-check.png` — проверочное наложение: распознанные номера павильонов (красным) поверх схемы.
- `tools/` — скрипты оцифровки и шаблон страницы.

## Что в `floor1-model.json`

Координаты в метрах: `x` вправо, `z` вниз по схеме. 1 пиксель схемы = 0,085 м, начало координат в пикселе (1400, 1820).

| Ключ | Что это |
|---|---|
| `rooms` | 390 помещений: `sector` (A–H или `tech`), `kind` (`pavilion`, `kiosk`, `store`, `cafe`, `stage`, `tech`), `codes` (номера вида `B1-061`), `name`, `area` (м²), `poly` (контур) |
| `walls` | наружные стены с проёмами входов (контуры штрихов, с отверстиями) |
| `footprint` | контур здания (пол и потолок) |
| `doors` | 22 входа: позиция и направление внутрь, `entrance` или `service` |
| `icons` | 43 значка: `stairs`, `escalator`, `wc`, `atm`, `cafe`, `buffet`, `info`, `exchange` |
| `flights` | 19 лестничных маршей и эскалаторов: прямоугольник и ось подъёма |
| `badges` | кольца секторов A1–H1 |
| `exterior` | паркинги, машины на них, улицы, летняя веранда, метро, подписи |

## Точность

- Контуры, размеры и цвета павильонов сняты со схемы автоматически по цвету сектора.
- Номера прочитаны OCR (Tesseract): номер есть у 294 помещений из 362 торговых. В отдельных номерах возможны ошибки, проверять по `floor1-check.png`. Явные ошибки исправлены в `FIX_CODES` в `tools/assemble.py`.
- Масштаб подобран по площади здания в OpenStreetMap (около 31 тыс. м², relation 7665794). Сама схема не строго в масштабе: на ней корпус почти квадратный, а в реальности вытянут.
- Высоты условные: потолок 5,2 м, павильон 3 м, крупный магазин 4,4 м, стены 10,5 м.

## Как добавить 2 этаж

Положить схему 2 этажа рядом как `floor2.png` и прогнать те же шаги, поменяв имена файлов:

```
python3 -I tools/seg.py floor2.png regions.json overlay.png
python3 -I tools/walls.py floor2.png regions.json walls.json walls_ov.png
python3 -I tools/arrows.py floor2.png regions.json <рамка одной стрелки «←»> arrows.json arrows_ov.png
python3 -I tools/icons.py floor2.png regions.json icons.json icons_ov.png
python3 -I tools/flights.py floor2.png regions.json icons.json flights.json flights_ov.png
python3 -I tools/ocr.py floor2.png regions.json regions_ocr.json
python3 -I tools/assemble.py <папка с файлами> model.json check.png
```

Нужны `opencv-python-headless`, `scipy`, `numpy`, `Pillow` и `tesseract-ocr` с языком `rus`. Координаты рамок плана и легенды заданы в `seg.py` под формат официального плаката, у плаката 2 этажа они, скорее всего, те же.

## Референсы внешнего вида (2024)

Фото использованы только как образец при моделировании. В модель они не встроены, текстуры нарисованы процедурно.

- [MSK1.RU, репортаж 4 декабря 2024](https://msk1.ru/text/business/2024/12/04/74832524/): коридоры с плиточным полом и цветными линиями на полу, витрины с подсветкой, закрытые рольставни, открытые фермы и вентиляция под потолком, лестница с эскалатором у DNS и «Технопарка», таблички павильонов (A1-015, B1-020A), кирпичный фасад со стелой брендов, красный козырёк входа «Горбушкин Двор, гипермолл». В репортаже сказано, что на 2 этаже пустует почти половина площадей и там в основном комплектующие для компьютеров.
- [Отзыв на otzovik.com (2017)](https://otzovik.com/review_4609507.html): вход, галерея 2 этажа над большим залом, фуд-корт.
- [Omnibus Design, навигация «Горбушкина Двора»](https://www.omnibusdesign.ru/space_design/element-gorbuskin_dvor.html): система секторов с буквами и цветами, указатели и графика на полу.
- [ShopAndMall](https://shopandmall.ru/torgovye-centry/gorbushkin_dvor-moskva-bagrationovskiy_proezd_d_7) и [Roomfi](https://roomfi.ru/torgovye-centry/51266-torgovyy-tsentr-gorbushkin-dvor/): атриум с галереей и красными перилами, медиа-холл со сценой, многоуровневый паркинг напротив, вход в «Перекрёсток».
- [OpenStreetMap, relation 7665794](https://www.openstreetmap.org/relation/7665794): реальный контур ТЦ и входы (данные © участники OpenStreetMap, ODbL).
