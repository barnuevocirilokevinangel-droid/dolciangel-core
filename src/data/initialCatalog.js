export const CATEGORIAS = [
  { id: 'tortas', label: 'Tortas', icon: '🎂', order: 1 },
  { id: 'cheesecakes', label: 'Cheesecakes', icon: '🍰', order: 2 },
  { id: 'pies', label: 'Pies', icon: '🥧', order: 3 },
  { id: 'kekes', label: 'Kekes', icon: '🧁', order: 4 },
  { id: 'bocados', label: 'Bocados', icon: '🥟', order: 5 },
  { id: 'jugos', label: 'Jugos', icon: '🥤', order: 6 },
  { id: 'cafes', label: 'Cafés', icon: '☕', order: 7 },
  { id: 'otros', label: 'Otros', icon: '📦', order: 8 },
];

export const INITIAL_PRODUCTS = [
  // 🎂 TORTAS
  {
    id: 'prod_torta_chocolate',
    nombre: 'Torta de Chocolate',
    categoria: 'tortas',
    precio: 6.00,
    stock_BA: 20,
    stock_VE: 15,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍫',
    descripcion: 'Bizcocho húmedo de chocolate con fudge artesanal'
  },
  {
    id: 'prod_torta_helada',
    nombre: 'Torta Helada',
    categoria: 'tortas',
    precio: 6.00,
    stock_BA: 12,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍓',
    descripcion: 'Gelatina de fresa, carlota y suave bizcochuelo'
  },
  {
    id: 'prod_crema_volteada',
    nombre: 'Crema Volteada',
    categoria: 'tortas',
    precio: 6.50,
    stock_BA: 15,
    stock_VE: 12,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍮',
    descripcion: 'Textura suave y sedosa con fino caramelo líquido'
  },
  {
    id: 'prod_tres_leches_clasica',
    nombre: 'Tres Leches Clásica',
    categoria: 'tortas',
    precio: 13.00,
    stock_BA: 18,
    stock_VE: 14,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥛',
    descripcion: 'Bañada en crema de tres leches y canela fina'
  },
  {
    id: 'prod_tres_leches_lucuma',
    nombre: 'Tres Leches de Lúcuma',
    categoria: 'tortas',
    precio: 13.00,
    stock_BA: 10,
    stock_VE: 8,
    disponible: true,
    mostrar_en_carta: true,
    icono: '✨',
    descripcion: 'Combinación perfecta de lúcuma natural y leche condensada'
  },

  // 🍰 CHEESECAKES
  {
    id: 'prod_cheesecake_fresa',
    nombre: 'Cheesecake de Fresa',
    categoria: 'cheesecakes',
    precio: 13.00,
    stock_BA: 14,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍓',
    descripcion: 'Base crocante con coulis de fresas frescas'
  },
  {
    id: 'prod_cheesecake_arandano',
    nombre: 'Cheesecake de Arándano',
    categoria: 'cheesecakes',
    precio: 13.00,
    stock_BA: 12,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🫐',
    descripcion: 'Queso crema de alta pastelería con reducción de arándanos'
  },
  {
    id: 'prod_cheesecake_maracuya',
    nombre: 'Cheesecake de Maracuyá',
    categoria: 'cheesecakes',
    precio: 13.00,
    stock_BA: 10,
    stock_VE: 8,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥭',
    descripcion: 'Equilibrio cítrico tropical y cremosidad'
  },
  {
    id: 'prod_cheesecake_oreo',
    nombre: 'Cheesecake Oreo',
    categoria: 'cheesecakes',
    precio: 14.00,
    stock_BA: 15,
    stock_VE: 12,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍪',
    descripcion: 'Crocantes trozos de galleta oreo dentro y fuera'
  },
  {
    id: 'prod_cheesecake_ny',
    nombre: 'Cheesecake New York',
    categoria: 'cheesecakes',
    precio: 14.00,
    stock_BA: 8,
    stock_VE: 6,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🧀',
    descripcion: 'El auténtico horneado neoyorquino denso y cremoso'
  },

  // 🥧 PIES
  {
    id: 'prod_pie_manzana',
    nombre: 'Pie de Manzana',
    categoria: 'pies',
    precio: 8.00,
    stock_BA: 16,
    stock_VE: 12,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍎',
    descripcion: 'Masa quebrada rellena de manzanas caramelizadas con canela'
  },
  {
    id: 'prod_pie_limon',
    nombre: 'Pie de Limón',
    categoria: 'pies',
    precio: 8.00,
    stock_BA: 20,
    stock_VE: 15,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍋',
    descripcion: 'Crema de limón ácida coronada con merengue suizo dorado'
  },
  {
    id: 'prod_pie_fresa',
    nombre: 'Pie de Fresa',
    categoria: 'pies',
    precio: 8.00,
    stock_BA: 10,
    stock_VE: 8,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍓',
    descripcion: 'Fresas seleccionadas sobre crema pastelera suave'
  },

  // 🧁 KEKES
  {
    id: 'prod_keke_zanahoria',
    nombre: 'Keke de Zanahoria con Pecanas',
    categoria: 'kekes',
    precio: 3.50,
    stock_BA: 25,
    stock_VE: 20,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥕',
    descripcion: 'Esponjoso con toque de canela, nuez moscada y pecanas'
  },
  {
    id: 'prod_keke_marmoleado',
    nombre: 'Keke Marmoleado',
    categoria: 'kekes',
    precio: 3.00,
    stock_BA: 25,
    stock_VE: 20,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🌀',
    descripcion: 'Fusión de vainilla y chocolate'
  },
  {
    id: 'prod_keke_arandanos',
    nombre: 'Keke de Arándanos con Limón',
    categoria: 'kekes',
    precio: 3.50,
    stock_BA: 18,
    stock_VE: 15,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍋',
    descripcion: 'Con arándanos enteros y glaseado alimonado'
  },
  {
    id: 'prod_keke_red_velvet',
    nombre: 'Keke Red Velvet',
    categoria: 'kekes',
    precio: 4.00,
    stock_BA: 15,
    stock_VE: 12,
    disponible: true,
    mostrar_en_carta: true,
    icono: '❤️',
    descripcion: 'Aterciopelado rojo con crema suave'
  },

  // 🥟 BOCADOS
  {
    id: 'prod_alfajor_clasico',
    nombre: 'Alfajor Artesanal',
    categoria: 'bocados',
    precio: 4.00,
    stock_BA: 40,
    stock_VE: 35,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍪',
    descripcion: 'Masa de maicena que se deshace en la boca, con harto manjar blanco'
  },
  {
    id: 'prod_pionono',
    nombre: 'Pionono con Manjar',
    categoria: 'bocados',
    precio: 4.00,
    stock_BA: 30,
    stock_VE: 25,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍥',
    descripcion: 'Enrollado tierno con manjar de olla'
  },
  {
    id: 'prod_empanada_pollo',
    nombre: 'Empanada de Pollo',
    categoria: 'bocados',
    precio: 5.00,
    stock_BA: 25,
    stock_VE: 20,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥟',
    descripcion: 'Masa hojaldrada dorada rellena de pechuga de pollo sazonada'
  },
  {
    id: 'prod_brazo_reina',
    nombre: 'Brazo de Reina',
    categoria: 'bocados',
    precio: 6.00,
    stock_BA: 15,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '👑',
    descripcion: 'Bocado relleno de crema y frutas'
  },

  // 🥤 JUGOS
  {
    id: 'prod_jugo_fresa',
    nombre: 'Jugo de Fresa',
    categoria: 'jugos',
    precio: 5.00,
    stock_BA: 30,
    stock_VE: 25,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍓',
    descripcion: 'Fresa 100% natural al agua o leche'
  },
  {
    id: 'prod_jugo_pina',
    nombre: 'Jugo de Piña',
    categoria: 'jugos',
    precio: 5.00,
    stock_BA: 30,
    stock_VE: 25,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍍',
    descripcion: 'Piña golden dulce y refrescante'
  },
  {
    id: 'prod_jugo_arandanos',
    nombre: 'Jugo Especial de Arándanos',
    categoria: 'jugos',
    precio: 7.00,
    stock_BA: 20,
    stock_VE: 15,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🫐',
    descripcion: 'Superalimento antioxidante batido al momento'
  },
  {
    id: 'prod_limonada_frozen',
    nombre: 'Jarra Limonada Frozen',
    categoria: 'jugos',
    precio: 12.00,
    stock_BA: 15,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍋',
    descripcion: 'Textura granizada refrescante ideal para compartir'
  },
  {
    id: 'prod_chicha_frozen',
    nombre: 'Chicha Morada Frozen',
    categoria: 'jugos',
    precio: 12.00,
    stock_BA: 15,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍇',
    descripcion: 'Receta tradicional con maíz morado, piña y clavo'
  },

  // ☕ CAFÉS
  {
    id: 'prod_cafe_americano',
    nombre: 'Café Americano',
    categoria: 'cafes',
    precio: 5.00,
    stock_BA: 50,
    stock_VE: 40,
    disponible: true,
    mostrar_en_carta: true,
    icono: '☕',
    descripcion: 'Extracción de café pasado en grano selecto peruano'
  },
  {
    id: 'prod_cafe_latte',
    nombre: 'Café Latte',
    categoria: 'cafes',
    precio: 7.00,
    stock_BA: 40,
    stock_VE: 35,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥛',
    descripcion: 'Espresso doble con leche vaporizada cremosa'
  },
  {
    id: 'prod_cafe_mocca',
    nombre: 'Café Mocca',
    categoria: 'cafes',
    precio: 8.00,
    stock_BA: 30,
    stock_VE: 25,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍫',
    descripcion: 'Café tostado, chocolate de cacao y leche espumosa'
  },
  {
    id: 'prod_frappe_cafe',
    nombre: 'Frappé de Café',
    categoria: 'cafes',
    precio: 10.00,
    stock_BA: 25,
    stock_VE: 20,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🧊',
    descripcion: 'Batido frío granizado con café y crema chantilly'
  },

  // 📦 OTROS
  {
    id: 'prod_sandwich_pollo',
    nombre: 'Sándwich de Pollo Clásico',
    categoria: 'otros',
    precio: 10.00,
    stock_BA: 20,
    stock_VE: 15,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥪',
    descripcion: 'Pechuga deshilachada con lechuga fresca y mayonesa casera'
  },
  {
    id: 'prod_ensalada_frutas',
    nombre: 'Ensalada de Frutas',
    categoria: 'otros',
    precio: 11.00,
    stock_BA: 15,
    stock_VE: 12,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🥗',
    descripcion: 'Mix de frutas de temporada con granola, yogurt y miel'
  },
  {
    id: 'prod_chocoflan',
    nombre: 'Chocoflan Especial',
    categoria: 'otros',
    precio: 5.50,
    stock_BA: 12,
    stock_VE: 10,
    disponible: true,
    mostrar_en_carta: true,
    icono: '🍮',
    descripcion: 'Pastel imposible: mitad bizcocho de chocolate y mitad flan'
  }
];
