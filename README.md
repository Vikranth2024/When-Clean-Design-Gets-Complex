# Solution — When Clean Design Gets Complex

This repository contains the **reference solution** for the database normalization challenge.

The original schema contained several design problems:

- multi-valued attributes
- supplier data mixed with product data
- category values stored as comma-separated strings
- inventory details embedded in product rows

The solution restructures the schema into **Third Normal Form (3NF)**.

---

# Key Improvements

The following improvements were made:

### 1. Categories Normalized
Products can belong to multiple categories.

Instead of storing categories in a comma-separated column, we created:

- `categories`
- `product_categories`

This allows flexible many-to-many relationships.

---

### 2. Supplier Data Separated

Supplier information is moved into its own table:

suppliers


Products now reference suppliers through a **foreign key**.

---

### 3. Inventory Separated

Inventory information such as stock quantity and warehouse location is stored in:


inventory


This keeps operational data separate from product definition data.

---

# Final Database Structure

Tables:


products
suppliers
categories
product_categories
inventory


Relationships:


products -> suppliers
products -> product_categories -> categories
products -> inventory


---

# Benefits of This Design

- eliminates duplicated supplier data
- supports multiple categories per product
- simplifies inventory management
- follows **Third Normal Form**

---

# Trade-off Discussion

Normalization improves **data integrity** but introduces more **JOIN operations** in queries.

Example:

Retrieving product with category now requires joins between:


products
product_categories
categories


In large systems, engineers sometimes use **controlled denormalization** to reduce query cost.

---

# Running the Solution

Step 1

Run the schema file:


schema/normalized_schema.sql


Step 2

Run the example queries:


queries/updated_product_queries.sql


---

# What You Should Notice

Queries now use **JOIN operations** to reconstruct related data.

This is expected in properly normalized databases.

---

# Learning Outcome

After studying this solution you should understand:

- how to normalize a schema to 3NF
- how relationships replace repeating fields
- why normalized designs increase join complexity