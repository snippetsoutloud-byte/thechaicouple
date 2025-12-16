"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Save, X, GripVertical, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProductManagement({ onProductsChange }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: "", price: "", inventory: "", buffer: "10" });
  const [formError, setFormError] = useState("");

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Load products
  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/products");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load products");
        return;
      }
      setProducts(data.products || []);
      if (onProductsChange) onProductsChange(data.products || []);
    } catch (err) {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function saveProducts(updatedProducts) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: updatedProducts }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save products");
        return false;
      }

      setProducts(data.products);
      if (onProductsChange) onProductsChange(data.products);
      setSuccess("Products saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      return true;
    } catch (err) {
      setError("Failed to save products");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openAddDialog() {
    setEditingProduct(null);
    setFormData({ name: "", price: "", inventory: "0", buffer: "10" });
    setFormError("");
    setDialogOpen(true);
  }

  function openEditDialog(product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: String(product.price),
      inventory: String(product.inventory),
      buffer: String(product.buffer),
    });
    setFormError("");
    setDialogOpen(true);
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    setFormError("");

    const name = formData.name.trim();
    const price = Number(formData.price);
    const inventory = Math.floor(Number(formData.inventory) || 0);
    const buffer = Math.floor(Number(formData.buffer) || 10);

    if (!name) {
      setFormError("Product name is required");
      return;
    }

    if (isNaN(price) || price < 0) {
      setFormError("Price must be a valid number");
      return;
    }

    const id = editingProduct?.id || name.toLowerCase().replace(/\s+/g, "_");

    // Check for duplicate names (excluding current product if editing)
    const duplicate = products.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== editingProduct?.id
    );
    if (duplicate) {
      setFormError("A product with this name already exists");
      return;
    }

    let updatedProducts;
    if (editingProduct) {
      // Update existing product
      updatedProducts = products.map((p) =>
        p.id === editingProduct.id
          ? { ...p, name, price, inventory, buffer }
          : p
      );
    } else {
      // Add new product
      const newProduct = {
        id,
        name,
        price,
        inventory,
        buffer,
        order: products.length,
      };
      updatedProducts = [...products, newProduct];
    }

    saveProducts(updatedProducts).then((success) => {
      if (success) {
        setDialogOpen(false);
      }
    });
  }

  function openDeleteDialog(product) {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  }

  function confirmDelete() {
    if (!productToDelete) return;

    const updatedProducts = products.filter((p) => p.id !== productToDelete.id);
    saveProducts(updatedProducts).then((success) => {
      if (success) {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      }
    });
  }

  function updateInventory(productId, delta) {
    const updatedProducts = products.map((p) => {
      if (p.id === productId) {
        return { ...p, inventory: Math.max(0, p.inventory + delta) };
      }
      return p;
    });
    setProducts(updatedProducts);
    saveProducts(updatedProducts);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Management</CardTitle>
          <CardDescription>Loading products...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Management</CardTitle>
              <CardDescription>
                Add, edit, or remove products. Set prices, inventory, and buffer thresholds.
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No products added yet.</p>
              <p className="text-sm">Click &quot;Add Product&quot; to create your first product.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{product.name}</h4>
                      <Badge variant="outline">₹{product.price}</Badge>
                      {product.inventory === 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : product.inventory <= product.buffer ? (
                        <Badge className="bg-amber-500">Low Stock ({product.inventory})</Badge>
                      ) : (
                        <Badge variant="secondary">{product.inventory} in stock</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Buffer threshold: {product.buffer} | ID: {product.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick inventory controls */}
                    <div className="flex items-center gap-1 mr-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateInventory(product.id, -1)}
                        disabled={product.inventory === 0 || saving}
                      >
                        -
                      </Button>
                      <span className="w-10 text-center text-sm font-medium">
                        {product.inventory}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateInventory(product.id, 1)}
                        disabled={saving}
                      >
                        +
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(product)}
                      disabled={saving}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(product)}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {saving && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Update the product details below."
                  : "Enter the details for the new product."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Special Chai"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productPrice">Price (₹) *</Label>
                  <Input
                    id="productPrice"
                    type="number"
                    min={0}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productInventory">Inventory</Label>
                  <Input
                    id="productInventory"
                    type="number"
                    min={0}
                    value={formData.inventory}
                    onChange={(e) => setFormData({ ...formData, inventory: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productBuffer">Buffer</Label>
                  <Input
                    id="productBuffer"
                    type="number"
                    min={0}
                    value={formData.buffer}
                    onChange={(e) => setFormData({ ...formData, buffer: e.target.value })}
                    placeholder="10"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Buffer: Low stock warning shows when inventory falls below this level
              </p>

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

