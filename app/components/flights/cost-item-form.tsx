"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import {
  costCategoryOptions,
  costCategoryValues,
  getCostCategoryLabel
} from "@/app/lib/costs/categories";

interface CostItemFormValues {
  costItemId?: string;
  category?: string;
  amount?: string;
  date?: string;
  vendor?: string;
  notes?: string;
  rate?: string;
  quantityHours?: string;
  fuelGallons?: string;
  fuelPrice?: string;
}

interface CostItemFormProps {
  action: string;
  submitLabel: string;
  pendingText: string;
  defaultValues?: CostItemFormValues;
  submitSize?: "default" | "sm" | "lg" | "icon";
}

const parseDecimalInput = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const formatCurrency = (value: number) => value.toFixed(2);

export function CostItemForm({
  action,
  submitLabel,
  pendingText,
  defaultValues,
  submitSize = "default"
}: CostItemFormProps) {
  const defaultCategory = useMemo(() => {
    const raw = defaultValues?.category ?? "";
    const normalized = raw.trim().toLowerCase();
    return costCategoryValues.includes(
      normalized as (typeof costCategoryValues)[number]
    )
      ? normalized
      : raw;
  }, [defaultValues?.category]);
  const [category, setCategory] = useState(defaultCategory);
  const [amount, setAmount] = useState(defaultValues?.amount ?? "");
  const [rate, setRate] = useState(defaultValues?.rate ?? "");
  const [quantityHours, setQuantityHours] = useState(
    defaultValues?.quantityHours ?? ""
  );
  const [fuelGallons, setFuelGallons] = useState(
    defaultValues?.fuelGallons ?? ""
  );
  const [fuelPrice, setFuelPrice] = useState(defaultValues?.fuelPrice ?? "");

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  const normalizedCategory = useMemo(
    () => category.trim().toLowerCase(),
    [category]
  );
  const showRateFields = ["rental", "instruction"].includes(normalizedCategory);
  const showFuelFields = normalizedCategory === "fuel";
  const categoryOptions = useMemo(() => {
    const options = [...costCategoryOptions];
    if (
      category.trim() &&
      !costCategoryValues.includes(
        category.trim().toLowerCase() as (typeof costCategoryValues)[number]
      )
    ) {
      options.push({
        value: category,
        label: getCostCategoryLabel(category)
      });
    }
    return options;
  }, [category]);

  useEffect(() => {
    if (showRateFields) {
      const parsedRate = parseDecimalInput(rate);
      const parsedHours = parseDecimalInput(quantityHours);
      if (parsedRate !== null && parsedHours !== null) {
        setAmount(formatCurrency(parsedRate * parsedHours));
      }
      return;
    }

    if (showFuelFields) {
      const parsedGallons = parseDecimalInput(fuelGallons);
      const parsedPrice = parseDecimalInput(fuelPrice);
      if (parsedGallons !== null && parsedPrice !== null) {
        setAmount(formatCurrency(parsedGallons * parsedPrice));
      }
    }
  }, [showRateFields, showFuelFields, rate, quantityHours, fuelGallons, fuelPrice]);

  const amountIsAutoCalculated =
    (showRateFields && rate.trim() && quantityHours.trim()) ||
    (showFuelFields && fuelGallons.trim() && fuelPrice.trim());

  return (
    <form action={action} method="post" className="mt-3 grid gap-3 lg:grid-cols-3">
      {defaultValues?.costItemId ? (
        <input type="hidden" name="costItemId" value={defaultValues.costItemId} />
      ) : null}
      <div className="lg:col-span-3">
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
          required
        >
          <option value="">Select category</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {showRateFields ? (
        <>
          <Input
            name="rate"
            type="number"
            step="0.01"
            placeholder="Rate ($/hr)"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
          <Input
            name="quantityHours"
            type="number"
            step="0.01"
            placeholder="Hours"
            value={quantityHours}
            onChange={(event) => setQuantityHours(event.target.value)}
          />
        </>
      ) : null}
      {showFuelFields ? (
        <>
          <Input
            name="fuelGallons"
            type="number"
            step="0.01"
            placeholder="Fuel gallons"
            value={fuelGallons}
            onChange={(event) => setFuelGallons(event.target.value)}
          />
          <Input
            name="fuelPrice"
            type="number"
            step="0.01"
            placeholder="Fuel price ($/gal)"
            value={fuelPrice}
            onChange={(event) => setFuelPrice(event.target.value)}
          />
        </>
      ) : null}
      <Input
        name="amount"
        type="number"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        readOnly={amountIsAutoCalculated}
        required={!amountIsAutoCalculated}
      />
      <Input
        name="date"
        type="date"
        required
        defaultValue={defaultValues?.date}
      />
      <Input name="vendor" placeholder="Vendor" defaultValue={defaultValues?.vendor} />
      <Input
        name="notes"
        placeholder="Notes"
        className="lg:col-span-2"
        defaultValue={defaultValues?.notes}
      />
      <div className="lg:col-span-3">
        <FormSubmitButton
          type="submit"
          size={submitSize}
          pendingText={pendingText}
        >
          {submitLabel}
        </FormSubmitButton>
      </div>
    </form>
  );
}
