'use strict';
// Dane geograficzne Polski do podziału na obszary (popyt, wyróżnienia, statystyki).
// Współrzędne środków i populacje (w tys.) są przybliżone; adresy i trasy pochodzą z Mapbox.
// [nazwa, szerokość, długość, populacja w tys., województwo]
const CITIES = [
  ['Warszawa', 52.2297, 21.0122, 1860, 'mazowieckie'], ['Kraków', 50.0647, 19.9450, 800, 'małopolskie'], ['Wrocław', 51.1079, 17.0385, 674, 'dolnośląskie'],
  ['Łódź', 51.7592, 19.4560, 655, 'łódzkie'], ['Poznań', 52.4064, 16.9252, 540, 'wielkopolskie'], ['Gdańsk', 54.3520, 18.6466, 486, 'pomorskie'],
  ['Szczecin', 53.4285, 14.5528, 391, 'zachodniopomorskie'], ['Bydgoszcz', 53.1235, 18.0084, 330, 'kujawsko-pomorskie'], ['Lublin', 51.2465, 22.5684, 334, 'lubelskie'],
  ['Białystok', 53.1325, 23.1688, 294, 'podlaskie'], ['Katowice', 50.2649, 19.0238, 285, 'śląskie'], ['Gdynia', 54.5189, 18.5305, 243, 'pomorskie'],
  ['Częstochowa', 50.8118, 19.1203, 210, 'śląskie'], ['Radom', 51.4027, 21.1471, 202, 'mazowieckie'], ['Rzeszów', 50.0412, 21.9991, 197, 'podkarpackie'],
  ['Toruń', 53.0138, 18.5984, 196, 'kujawsko-pomorskie'], ['Sosnowiec', 50.2863, 19.1041, 193, 'śląskie'], ['Kielce', 50.8661, 20.6286, 186, 'świętokrzyskie'],
  ['Gliwice', 50.2945, 18.6714, 175, 'śląskie'], ['Olsztyn', 53.7784, 20.4801, 170, 'warmińsko-mazurskie'], ['Zabrze', 50.3249, 18.7857, 170, 'śląskie'],
  ['Bielsko-Biała', 49.8224, 19.0584, 168, 'śląskie'], ['Bytom', 50.3484, 18.9157, 160, 'śląskie'], ['Zielona Góra', 51.9356, 15.5062, 139, 'lubuskie'],
  ['Rybnik', 50.0971, 18.5463, 136, 'śląskie'], ['Ruda Śląska', 50.2558, 18.8556, 134, 'śląskie'], ['Opole', 50.6751, 17.9213, 127, 'opolskie'],
  ['Tychy', 50.1372, 18.9664, 126, 'śląskie'], ['Gorzów Wielkopolski', 52.7368, 15.2288, 120, 'lubuskie'], ['Elbląg', 54.1561, 19.4045, 117, 'warmińsko-mazurskie'],
  ['Płock', 52.5463, 19.7065, 117, 'mazowieckie'], ['Dąbrowa Górnicza', 50.3217, 19.1949, 117, 'śląskie'], ['Wałbrzych', 50.7714, 16.2843, 110, 'dolnośląskie'],
  ['Włocławek', 52.6483, 19.0677, 108, 'kujawsko-pomorskie'], ['Tarnów', 50.0121, 20.9858, 107, 'małopolskie'], ['Chorzów', 50.2975, 18.9545, 107, 'śląskie'],
  ['Koszalin', 54.1944, 16.1722, 106, 'zachodniopomorskie'], ['Kalisz', 51.7611, 18.0910, 99, 'wielkopolskie'], ['Legnica', 51.2070, 16.1553, 98, 'dolnośląskie'],
  ['Grudziądz', 53.4837, 18.7536, 94, 'kujawsko-pomorskie'], ['Jaworzno', 50.2051, 19.2747, 90, 'śląskie'], ['Słupsk', 54.4641, 17.0285, 89, 'pomorskie'],
  ['Jastrzębie-Zdrój', 49.9554, 18.5975, 87, 'śląskie'], ['Nowy Sącz', 49.6218, 20.6970, 83, 'małopolskie'], ['Jelenia Góra', 50.9044, 15.7194, 78, 'dolnośląskie'],
  ['Siedlce', 52.1676, 22.2902, 77, 'mazowieckie'], ['Mysłowice', 50.2081, 19.1666, 74, 'śląskie'], ['Konin', 52.2230, 18.2511, 72, 'wielkopolskie'],
  ['Piła', 53.1513, 16.7383, 72, 'wielkopolskie'], ['Piotrków Trybunalski', 51.4052, 19.7032, 71, 'łódzkie'], ['Inowrocław', 52.7976, 18.2603, 71, 'kujawsko-pomorskie'],
  ['Lubin', 51.4010, 16.2015, 71, 'dolnośląskie'], ['Ostrów Wielkopolski', 51.6551, 17.8063, 71, 'wielkopolskie'], ['Suwałki', 54.1118, 22.9309, 69, 'podlaskie'],
  ['Stargard', 53.3365, 15.0496, 67, 'zachodniopomorskie'], ['Gniezno', 52.5349, 17.5826, 67, 'wielkopolskie'], ['Ostrowiec Świętokrzyski', 50.9294, 21.3854, 66, 'świętokrzyskie'],
  ['Siemianowice Śląskie', 50.3268, 19.0296, 66, 'śląskie'], ['Głogów', 51.6634, 16.0845, 66, 'dolnośląskie'], ['Pabianice', 51.6645, 19.3547, 64, 'łódzkie'],
  ['Leszno', 51.8406, 16.5749, 62, 'wielkopolskie'], ['Zamość', 50.7231, 23.2520, 62, 'lubelskie'], ['Łomża', 53.1781, 22.0593, 62, 'podlaskie'],
  ['Żory', 50.0447, 18.7004, 62, 'śląskie'], ['Pruszków', 52.1708, 20.8125, 62, 'mazowieckie'], ['Ełk', 53.8282, 22.3647, 61, 'warmińsko-mazurskie'],
  ['Tomaszów Mazowiecki', 51.5310, 20.0083, 61, 'łódzkie'], ['Chełm', 51.1431, 23.4716, 60, 'lubelskie'], ['Mielec', 50.2873, 21.4239, 60, 'podkarpackie'],
  ['Kędzierzyn-Koźle', 50.3497, 18.2123, 60, 'opolskie'], ['Przemyśl', 49.7838, 22.7678, 59, 'podkarpackie'], ['Stalowa Wola', 50.5826, 22.0536, 59, 'podkarpackie'],
  ['Tczew', 54.0924, 18.7779, 59, 'pomorskie'], ['Biała Podlaska', 52.0325, 23.1149, 57, 'lubelskie'], ['Bełchatów', 51.3687, 19.3564, 56, 'łódzkie'],
  ['Świdnica', 50.8436, 16.4894, 56, 'dolnośląskie'], ['Będzin', 50.3271, 19.1289, 56, 'śląskie'], ['Zgierz', 51.8562, 19.4062, 55, 'łódzkie'],
  ['Piekary Śląskie', 50.3828, 18.9455, 55, 'śląskie'], ['Racibórz', 50.0919, 18.2195, 54, 'śląskie'], ['Legionowo', 52.4048, 20.9264, 54, 'mazowieckie'],
  ['Ostrołęka', 53.0866, 21.5743, 51, 'mazowieckie'], ['Piaseczno', 52.0814, 21.0237, 50, 'mazowieckie'], ['Rumia', 54.5709, 18.3878, 49, 'pomorskie'],
  ['Świętochłowice', 50.2963, 18.9174, 49, 'śląskie'], ['Zawiercie', 50.4878, 19.4170, 49, 'śląskie'], ['Starachowice', 51.0374, 21.0716, 48, 'świętokrzyskie'],
  ['Wejherowo', 54.6059, 18.2350, 47, 'pomorskie'], ['Puławy', 51.4165, 21.9693, 47, 'lubelskie'], ['Skierniewice', 51.9547, 20.1584, 47, 'łódzkie'],
  ['Kołobrzeg', 54.1757, 15.5833, 46, 'zachodniopomorskie'], ['Krosno', 49.6887, 21.7706, 46, 'podkarpackie'], ['Otwock', 52.1059, 21.2616, 45, 'mazowieckie'],
  ['Ciechanów', 52.8811, 20.6197, 43, 'mazowieckie'], ['Kutno', 52.2310, 19.3642, 42, 'łódzkie'], ['Sieradz', 51.5953, 18.7307, 41, 'łódzkie'],
  ['Mińsk Mazowiecki', 52.1793, 21.5609, 40, 'mazowieckie'], ['Świnoujście', 53.9105, 14.2471, 40, 'zachodniopomorskie'], ['Marki', 52.3253, 21.1044, 39, 'mazowieckie'],
  ['Ząbki', 52.2926, 21.1061, 38, 'mazowieckie'], ['Bolesławiec', 51.2626, 15.5690, 38, 'dolnośląskie'], ['Nowa Sól', 51.8030, 15.7169, 38, 'lubuskie'],
  ['Oleśnica', 51.2091, 17.3800, 37, 'dolnośląskie'], ['Żary', 51.6383, 15.1371, 37, 'lubuskie'], ['Oświęcim', 50.0344, 19.2098, 36, 'małopolskie'],
  ['Sopot', 54.4416, 18.5601, 35, 'pomorskie'], ['Nowy Targ', 49.4775, 20.0328, 33, 'małopolskie'], ['Luboń', 52.3470, 16.8811, 32, 'wielkopolskie'],
  ['Pruszcz Gdański', 54.2621, 18.6363, 32, 'pomorskie'], ['Swarzędz', 52.4129, 17.0767, 31, 'wielkopolskie'], ['Augustów', 53.8434, 22.9790, 30, 'podlaskie'],
  ['Września', 52.3254, 17.5650, 30, 'wielkopolskie'], ['Zakopane', 49.2992, 19.9496, 27, 'małopolskie'], ['Wieliczka', 49.9871, 20.0646, 24, 'małopolskie'],
  ['Łomianki', 52.3346, 20.8858, 17, 'mazowieckie']
];

// Uproszczony obrys Polski (szerokość, długość), z niewielkim zapasem przy granicach.
const POLAND = [[53.93, 14.15], [54.24, 15.30], [54.58, 16.60], [54.86, 17.75], [54.88, 18.45], [54.48, 19.62], [54.40, 20.50], [54.43, 22.85], [54.37, 23.55],
  [53.95, 23.58], [53.20, 23.98], [52.65, 23.95], [52.20, 23.25], [51.62, 23.70], [51.10, 24.15], [50.45, 24.15], [50.00, 23.45], [49.50, 22.75], [49.00, 22.92],
  [49.08, 22.45], [49.42, 21.85], [49.38, 20.95], [49.17, 20.07], [49.42, 19.45], [49.53, 18.95], [49.98, 18.55], [50.08, 17.85], [50.36, 17.65], [50.23, 16.95],
  [50.08, 16.62], [50.43, 16.32], [50.68, 16.05], [50.80, 15.25], [50.98, 14.80], [51.42, 14.95], [51.95, 14.68], [52.50, 14.55], [52.95, 14.12], [53.40, 14.38]];

module.exports = { CITIES, POLAND };
