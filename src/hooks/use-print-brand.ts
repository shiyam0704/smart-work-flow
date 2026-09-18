import { useActiveCompany } from "@/hooks/use-company";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { DEFAULT_PRINT_OPTIONS, type PrintBrand, type PrintOptions } from "@/lib/invoice-print";

/** Builds the branded header/footer data and print layout options used by printed documents. */
export function usePrintBrand(): {
  brand: PrintBrand;
  printOptions: PrintOptions;
  receiptPrintOptions: PrintOptions;
  loading: boolean;
} {
  const { company } = useActiveCompany();
  const { settings, loading } = useInvoiceSettings();
  const logo = company?.logo_url || null;

  const printOptions: PrintOptions = {
    paperSize: settings?.paper_size ?? DEFAULT_PRINT_OPTIONS.paperSize,
    template: settings?.print_template ?? DEFAULT_PRINT_OPTIONS.template,
    accentColor: settings?.print_accent_color || DEFAULT_PRINT_OPTIONS.accentColor,
    rowsFirstPage: Number(settings?.rows_first_page ?? DEFAULT_PRINT_OPTIONS.rowsFirstPage),
    rowsNextPage: Number(settings?.rows_next_page ?? DEFAULT_PRINT_OPTIONS.rowsNextPage),
    repeatTableHeader: settings?.repeat_table_header ?? DEFAULT_PRINT_OPTIONS.repeatTableHeader,
    repeatBrandHeader: settings?.repeat_brand_header ?? DEFAULT_PRINT_OPTIONS.repeatBrandHeader,
    showPageNumbers: settings?.show_page_numbers ?? DEFAULT_PRINT_OPTIONS.showPageNumbers,
    showContinuedMarker: settings?.show_continued_marker ?? DEFAULT_PRINT_OPTIONS.showContinuedMarker,
  };

  return {
    loading,
    printOptions,
    receiptPrintOptions: {
      ...printOptions,
      paperSize: settings?.receipt_paper_size ?? printOptions.paperSize,
    },
    brand: {
      companyName: company?.name ?? "",
      logoUrl: logo,
      legalName: settings?.legal_name || company?.name || "",
      gstin: settings?.gstin ?? "",
      pan: settings?.pan ?? "",
      address: settings?.registered_address ?? "",
      stateName: settings?.state_name ?? "",
      stateCode: settings?.state_code ?? "",
      email: settings?.email ?? "",
      phone: settings?.phone ?? "",
      bankName: settings?.bank_name ?? "",
      bankAccountName: settings?.bank_account_name ?? "",
      bankAccountNo: settings?.bank_account_no ?? "",
      bankIfsc: settings?.bank_ifsc ?? "",
      upiId: settings?.upi_id ?? "",
      signatureUrl: settings?.signature_url ?? "",
      footerNote: settings?.footer_note ?? "",
    },
  };
}
