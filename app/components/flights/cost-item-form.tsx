"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";

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

const categorySuggestions = ["Rental", "Instruction", "Fuel", "Parking", "Fees"];

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
  const [category, setCategory] = useState(defaultValues?.category ?? "");
  const [amount, setAmount] = useState(defaultValues?.amount ?? "");
  const [rate, setRate] = useState(defaultValues?.rate ?? "");
  const [quantityHours, setQuantityHours] = useState(
    defaultValues?.quantityHours ?? ""
  );
  const [fuelGallons, setFuelGallons] = useState(
    defaultValues?.fuelGallons ?? ""
  );
  const [fuelPrice, setFuelPrice] = useState(defaultValues?.fuelPrice ?? "");

  const normalizedCategory = useMemo(
    () => category.trim().toLowerCase(),
    [category]
  );
  const showRateFields = ["rental", "instruction"].includes(normalizedCategory);
  const showFuelFields = normalizedCategory === "fuel";

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
    <form action={action} method="post" className="mt-3 grid gap-3 md:grid-cols-3">
      {defaultValues?.costItemId ? (
        <input type="hidden" name="costItemId" value={defaultValues.costItemId} />
      ) : null}
      <div className="md:col-span-3">
        <Input
          name="category"
          placeholder="Category"
          list="cost-category-options"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          required
        />
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
        className="md:col-span-2"
        defaultValue={defaultValues?.notes}
      />
      <div className="md:col-span-3">
        <FormSubmitButton
          type="submit"
          size={submitSize}
          pendingText={pendingText}
        >
          {submitLabel}
        </FormSubmitButton>
      </div>
      <datalist id="cost-category-options">
        {categorySuggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </form>
  );
}
