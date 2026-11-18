import { menuItemsCollection } from '../config/db.js';

const now = Date.now();
const minsAgo = (m) => new Date(now - m * 60 * 1000);

const initialMenuItems = [
  // 1-3: Classic Pizza
  {
    name: 'Margherita Basil Classico',
    description:
      'San Marzano tomato sauce, fresh buffalo mozzarella, sweet basil leaves, and extra virgin olive oil on wood-fired crust.',
    price: 12.99,
    originalPrice: 15.99,
    category: 'Classic Pizza',
    rating: 4.9,
    isOffer: true,
    discountLabel: '20% OFF',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
    toppings: ['Buffalo Mozzarella', 'Fresh Basil', 'San Marzano Sauce', 'Olive Oil'],
    restaurantName: 'PizzaHub Flagship Kitchen',
    status: 'approved',
    createdAt: minsAgo(10),
  },
  {
    name: 'Four Cheese Quattro Formaggi',
    description:
      'Rich blend of aged mozzarella, sharp gorgonzola, creamy fontina, and grated parmigiano-reggiano baked to golden perfection.',
    price: 14.49,
    category: 'Classic Pizza',
    rating: 4.8,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    toppings: ['Mozzarella', 'Gorgonzola', 'Parmesan', 'Fontina'],
    restaurantName: 'Napoli Wood-Fired Kitchen',
    status: 'approved',
    createdAt: minsAgo(45),
  },
  {
    name: 'Crispy Garlic & Herb Neapolitan',
    description:
      'Hand-stretched sourdough base brushed with roasted garlic butter, oregano, melted provolone, and sun-dried tomatoes.',
    price: 11.49,
    category: 'Classic Pizza',
    rating: 4.6,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=800&q=80',
    toppings: ['Roasted Garlic', 'Oregano', 'Provolone', 'Sun-dried Tomatoes'],
    restaurantName: 'PizzaHub Flagship Kitchen',
    status: 'approved',
    createdAt: minsAgo(120),
  },

  // 4-6: Meat Lovers
  {
    name: 'Double Pepperoni Firehouse',
    description:
      'Loaded with crispy cupped beef pepperoni, smoked mozzarella, crushed chili flakes, and signature spicy marinara.',
    price: 15.99,
    originalPrice: 18.99,
    category: 'Meat Lovers',
    rating: 5.0,
    isOffer: true,
    discountLabel: 'HOT DEAL',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80',
    toppings: ['Double Pepperoni', 'Smoked Mozzarella', 'Chili Flakes', 'Spicy Marinara'],
    restaurantName: 'Firehouse Pizzeria',
    status: 'approved',
    createdAt: minsAgo(5),
  },
  {
    name: 'Smoky BBQ Chicken Feast',
    description:
      'Chargrilled chicken breast tossed in hickory BBQ sauce with caramelized red onions, cilantro, and melted cheddar.',
    price: 16.49,
    category: 'Meat Lovers',
    rating: 4.9,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
    toppings: ['Grilled Chicken', 'Hickory BBQ Sauce', 'Red Onions', 'Cheddar'],
    restaurantName: 'PizzaHub Flagship Kitchen',
    status: 'approved',
    createdAt: minsAgo(30),
  },
  {
    name: 'Ultimate Carnivore Family Combo',
    description:
      'Large carnivore pizza loaded with beef sausage, bacon & pepperoni plus 4 garlic breadsticks and 2 chilled drinks.',
    price: 22.99,
    originalPrice: 28.99,
    category: 'Meat Lovers',
    rating: 4.9,
    isOffer: true,
    discountLabel: 'FAMILY COMBO',
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=80',
    toppings: ['Beef Sausage', 'Smoky Bacon', 'Pepperoni', 'Garlic Bread + 2 Drinks'],
    restaurantName: 'Firehouse Pizzeria',
    status: 'approved',
    createdAt: minsAgo(15),
  },

  // 7-9: Veggie Delight
  {
    name: 'Mediterranean Garden Veggie',
    description: 'Topped with Kalamata olives, baby spinach, bell peppers, cherry tomatoes, feta cheese, and oregano.',
    price: 13.99,
    category: 'Veggie Delight',
    rating: 4.7,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=800&q=80',
    toppings: ['Kalamata Olives', 'Baby Spinach', 'Bell Peppers', 'Feta Cheese'],
    restaurantName: 'GreenOven Kitchen',
    status: 'approved',
    createdAt: minsAgo(60),
  },
  {
    name: 'Truffle Wild Mushroom Bianca',
    description:
      'White garlic cream base layered with roasted cremini mushrooms, caramelized shallots, thyme, and truffle oil.',
    price: 15.49,
    category: 'Veggie Delight',
    rating: 4.8,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1548369937-47519962c11a?auto=format&fit=crop&w=800&q=80',
    toppings: ['Cremini Mushrooms', 'Truffle Oil', 'Caramelized Shallots', 'Thyme'],
    restaurantName: 'Napoli Wood-Fired Kitchen',
    status: 'approved',
    createdAt: minsAgo(90),
  },
  {
    name: 'Spicy Jalapeño & Paneer Duo Offer',
    description:
      'Two medium marinated paneer tikka & jalapeño pizzas with extra mozzarella—perfect weekend duo offer package.',
    price: 19.99,
    originalPrice: 24.99,
    category: 'Veggie Delight',
    rating: 4.9,
    isOffer: true,
    discountLabel: 'WEEKEND DUO',
    image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=800&q=80',
    toppings: ['Marinated Paneer', 'Jalapeños', 'Sweet Corn', '2 Medium Pizzas'],
    restaurantName: 'GreenOven Kitchen',
    status: 'approved',
    createdAt: minsAgo(25),
  },

  // 10-12: Sides & Drinks
  {
    name: 'Cheesy Garlic Breadsticks',
    description:
      'Warm oven-baked breadsticks brushed with roasted garlic herb butter, topped with melted mozzarella and marinara dip.',
    price: 6.99,
    category: 'Sides & Drinks',
    rating: 4.8,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?auto=format&fit=crop&w=800&q=80',
    toppings: ['Garlic Butter', 'Mozzarella', 'Parsley', 'Marinara Dip'],
    restaurantName: 'PizzaHub Flagship Kitchen',
    status: 'approved',
    createdAt: minsAgo(150),
  },
  {
    name: 'Crispy Peri-Peri Chicken Wings (8 Pcs)',
    description: '8 pieces of oven-roasted spicy peri-peri wings served with cool ranch dip and celery sticks.',
    price: 9.49,
    originalPrice: 11.49,
    category: 'Sides & Drinks',
    rating: 4.9,
    isOffer: true,
    discountLabel: 'SAVE $2',
    image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=800&q=80',
    toppings: ['Peri-Peri Glaze', 'Ranch Dip', 'Sesame Seeds'],
    restaurantName: 'Firehouse Pizzeria',
    status: 'approved',
    createdAt: minsAgo(40),
  },
  {
    name: 'Sparkling Mint Citrus Cooler',
    description: 'Chilled artisan soda infused with freshly squeezed lime, blood orange, crushed mint leaves, and ice.',
    price: 4.49,
    category: 'Sides & Drinks',
    rating: 4.7,
    isOffer: false,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    toppings: ['Fresh Mint', 'Blood Orange', 'Sparkling Water'],
    restaurantName: 'PizzaHub Flagship Kitchen',
    status: 'approved',
    createdAt: minsAgo(200),
  },
];

export const seedMenuIfEmpty = async () => {
  try {
    const count = await menuItemsCollection.countDocuments();
    if (count === 0) {
      await menuItemsCollection.insertMany(initialMenuItems);
      console.log('Seeded 12 sorted & offer-ready pizza items into MongoDB!');
    }
  } catch (error) {
    console.error('Menu seeding error:', error.message);
  }
};
