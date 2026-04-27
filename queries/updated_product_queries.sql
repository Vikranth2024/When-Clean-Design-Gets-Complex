-- UPDATED QUERIES FOR NORMALIZED DATABASE

-- =============================
-- Query 1
-- Get all products
-- =============================

SELECT *
FROM products;



-- =============================
-- Query 2
-- Get products in Electronics category
-- =============================

SELECT p.product_name, c.category_name
FROM products p
JOIN product_categories pc
ON p.product_id = pc.product_id
JOIN categories c
ON pc.category_id = c.category_id
WHERE c.category_name = 'Electronics';



-- =============================
-- Query 3
-- Get supplier details for products
-- =============================

SELECT p.product_name, s.supplier_name, s.supplier_phone
FROM products p
JOIN suppliers s
ON p.supplier_id = s.supplier_id;



-- =============================
-- Query 4
-- Find products with low stock
-- =============================

SELECT p.product_name, i.stock_quantity
FROM products p
JOIN inventory i
ON p.product_id = i.product_id
WHERE i.stock_quantity < 10;