# Odoo API Integration

This document explains how to set up and use the Odoo API integration in your application.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Supabase Secrets Management](#supabase-secrets-management)
3. [Local Development Setup](#local-development-setup)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)

## Environment Setup

### 1. Create Environment Variables

Create a `.env` file in your project root (copy from `env.example`):

```bash
# Copy the example file
cp env.example .env
```

Fill in your Odoo credentials in the `.env` file:

```env
# Odoo API Configuration
VITE_ODOO_URL=https://your-odoo-instance.com
VITE_ODOO_DATABASE=your_database_name
VITE_ODOO_USERNAME=your_username@example.com
VITE_ODOO_PASSWORD=your_password
VITE_ODOO_API_KEY=your_api_key_here  # Optional
```

### 2. Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VITE_ODOO_URL` | Your Odoo server URL | Yes | `https://company.odoo.com` |
| `VITE_ODOO_DATABASE` | Odoo database name | Yes | `company_production` |
| `VITE_ODOO_USERNAME` | Odoo username/email | Yes | `user@company.com` |
| `VITE_ODOO_PASSWORD` | Odoo password | Yes | `your_password` |
| `VITE_ODOO_API_KEY` | API key (if using) | No | `api_key_123` |

## Supabase Secrets Management

### For Production Deployment

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Go to **Settings** > **Environment Variables**

2. **Add Environment Variables**
   - Add the same variables as in your `.env` file
   - Make sure to prefix with `VITE_` for frontend access

3. **For Edge Functions (Backend)**
   - If using Supabase Edge Functions, add variables without `VITE_` prefix
   - These will be available in your backend code

### Environment Variable Security

- ✅ **Safe for frontend**: Variables prefixed with `VITE_`
- ❌ **Never expose**: Passwords, API keys without proper security
- 🔒 **Backend only**: Sensitive data should be handled server-side

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Start Development Server

```bash
npm run dev
# or
yarn dev
```

### 3. Test Odoo Connection

The Odoo integration will automatically attempt to authenticate when you use any Odoo-related components.

## Usage Examples

### Basic Usage in React Components

```tsx
import { useOdooProducts } from '@/hooks/useOdoo';

function MyComponent() {
  const { products, isLoading, error, fetchProducts } = useOdooProducts();

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {products.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

### Using the Odoo Service Directly

```tsx
import odooService from '@/services/odoo.service';

// Initialize and authenticate
await odooService.initialize();

// Get products
const products = await odooService.getProducts(50);

// Search products
const searchResults = await odooService.searchProducts('laptop');

// Create a product
const newProductId = await odooService.createProduct({
  name: 'New Product',
  list_price: 99.99,
  default_code: 'PROD001'
});
```

### Using the Odoo Client Directly

```tsx
import odooClient from '@/integrations/odoo/client';

// Authenticate
await odooClient.authenticate();

// Call any Odoo method
const result = await odooClient.callMethod('res.partner', 'search_read', [
  [['customer', '=', true]],
  ['id', 'name', 'email']
]);
```

## API Reference

### OdooService Methods

#### Authentication
- `initialize()`: Initialize and authenticate with Odoo
- `isAuthenticated()`: Check if authenticated
- `getAuthStatus()`: Get authentication status and session info

#### Product Operations
- `getProducts(limit?, offset?)`: Get products with pagination
- `getProductById(id)`: Get single product by ID
- `searchProducts(query, limit?)`: Search products by name or code
- `createProduct(data)`: Create new product
- `updateProduct(id, data)`: Update existing product
- `deleteProduct(id)`: Delete product

#### Partner Operations
- `getPartners(limit?, offset?)`: Get partners with pagination
- `getPartnerById(id)`: Get single partner by ID
- `searchPartners(query, limit?)`: Search partners by name or email
- `createPartner(data)`: Create new partner
- `updatePartner(id, data)`: Update existing partner

#### Sale Order Operations
- `getSaleOrders(limit?, offset?)`: Get sale orders with pagination
- `getSaleOrderById(id)`: Get single sale order by ID

#### Generic Operations
- `callMethod(model, method, params?, kwargs?)`: Call any Odoo method
- `searchRead(model, domain?, fields?, offset?, limit?, order?)`: Search and read records
- `count(model, domain?)`: Count records

### React Hooks

#### `useOdoo()`
Returns authentication status and service instance.

#### `useOdooProducts(limit?)`
Returns products state and operations.

#### `useOdooPartners(limit?)`
Returns partners state and operations.

#### `useOdooSaleOrders(limit?)`
Returns sale orders state and operations.

## Troubleshooting

### Common Issues

#### 1. Authentication Failed
```
Error: Odoo API error: Invalid credentials
```

**Solution:**
- Check your username and password in `.env`
- Verify the database name is correct
- Ensure the user has API access permissions

#### 2. CORS Issues
```
Error: HTTP error! status: 403
```

**Solution:**
- Configure CORS in your Odoo server
- Add your domain to allowed origins in Odoo settings

#### 3. Network Errors
```
Error: Failed to fetch
```

**Solution:**
- Check if Odoo server is accessible
- Verify the URL in `VITE_ODOO_URL`
- Check network connectivity

#### 4. Environment Variables Not Loading
```
Error: Configuration missing
```

**Solution:**
- Restart your development server after adding `.env`
- Ensure variables start with `VITE_`
- Check file permissions on `.env`

### Debug Mode

Enable debug logging by adding to your `.env`:

```env
VITE_DEBUG_ODOO=true
```

### Testing Connection

You can test the Odoo connection using the browser console:

```javascript
import odooService from '@/services/odoo.service';

// Test authentication
odooService.initialize().then(success => {
  console.log('Authentication:', success);
  console.log('Session:', odooService.getAuthStatus());
});
```

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** regularly
4. **Limit API permissions** to minimum required
5. **Use HTTPS** for production Odoo instances
6. **Implement proper error handling** to avoid exposing sensitive information

## Support

For issues related to:
- **Odoo API**: Check Odoo documentation
- **Integration**: Check this documentation
- **Environment setup**: Verify your `.env` configuration
- **Authentication**: Ensure credentials are correct

## Files Structure

```
src/
├── integrations/
│   └── odoo/
│       └── client.ts          # Odoo API client
├── services/
│   └── odoo.service.ts        # Odoo service layer
├── hooks/
│   └── useOdoo.ts            # React hooks for Odoo
└── components/
    └── OdooProducts.tsx      # Example component
``` 