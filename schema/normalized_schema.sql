-- NORMALIZED DATABASE SCHEMA
-- This design follows Third Normal Form (3NF)

-- =========================
-- SUPPLIERS
-- =========================

CREATE TABLE suppliers (

    supplier_id INT PRIMARY KEY,
    supplier_name VARCHAR(100),
    supplier_phone VARCHAR(20),
    supplier_email VARCHAR(100)

);

-- =========================
-- PRODUCTS
-- =========================

CREATE TABLE products (

    product_id INT PRIMARY KEY,
    product_name VARCHAR(100),
    supplier_id INT,
    price DECIMAL(10,2),

    FOREIGN KEY (supplier_id)
    REFERENCES suppliers(supplier_id)

);

-- =========================
-- CATEGORIES
-- =========================

CREATE TABLE categories (

    category_id INT PRIMARY KEY,
    category_name VARCHAR(100)

);

-- =========================
-- PRODUCT-CATEGORY RELATION
-- =========================

CREATE TABLE product_categories (

    product_id INT,
    category_id INT,

    PRIMARY KEY (product_id, category_id),

    FOREIGN KEY (product_id)
    REFERENCES products(product_id),

    FOREIGN KEY (category_id)
    REFERENCES categories(category_id)

);

-- =========================
-- INVENTORY
-- =========================

CREATE TABLE inventory (

    inventory_id INT PRIMARY KEY,
    product_id INT,
    warehouse_location VARCHAR(100),
    stock_quantity INT,

    FOREIGN KEY (product_id)
    REFERENCES products(product_id)

);