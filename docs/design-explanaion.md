# Design Explanation

This document explains how the schema was normalized.

---

# Problem 1: Multi-valued Categories

Original design stored categories like:


"Electronics,Mobile,Gadgets"


This violates **First Normal Form**.

Solution:

Separate categories into their own table and create a **many-to-many relationship**.

Tables created:


categories
product_categories


---

# Problem 2: Supplier Data Mixed with Products

Supplier details were repeated across many product rows.

This leads to:

- duplicate data
- update anomalies

Solution:

Move supplier information into a separate table.


suppliers


Products reference suppliers via **foreign key**.

---

# Problem 3: Inventory Stored Inside Products

Inventory values change frequently.

Keeping them in the product table mixes **static product data** with **dynamic operational data**.

Solution:

Create an `inventory` table.

This allows:

- tracking stock changes
- scaling inventory systems independently

---

# Final Design Outcome

The schema now satisfies **Third Normal Form** because:

- all attributes depend on the primary key
- no repeating groups exist
- no transitive dependencies remain

---

# Trade-off

The new design requires more JOINs in queries.

However, the benefits include:

- cleaner updates
- better scalability
- reduced redundancy