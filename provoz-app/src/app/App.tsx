import { useState, useRef, useCallback, useEffect } from "react";
import {
  ShoppingCart,
  Camera,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  FileText,
  Clock,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  User,
} from "lucide-react";
import {
  createOrder,
  fetchMe,
  fetchReceipts,
  fetchSupplierItems,
  fetchSuppliers,
  formatCents,
  categoryFromApi,
  hasPermission,
  login as apiLoginRequest,
  logout as apiLogoutRequest,
  previewOrder,
  sendOrder,
  uploadReceipt,
  type AuthUser,
  type Supplier as ApiSupplier,
  type SupplierItem as ApiSupplierItem,
  type ReceiptUiCategory,
} from "@/lib/provozApi";
import { InstallAppBanner } from "@/app/InstallAppBanner";
import { ShiftsTab } from "@/app/ShiftsTab";
// Logo inlined — avoids Vite asset resolution issues in sandboxed environments
function StageBistroLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1195 512"
      className={className}
      aria-label="Stage Bistro"
    >
      <path
        fill="#ffffff"
        fillRule="evenodd"
        d="M 540.75,461.75 L 539.00,463.50 L 539.00,466.50 L 541.00,468.50 L 543.25,468.50 L 545.25,466.00 L 545.00,463.75 L 543.25,461.75 Z M 585.50,432.25 L 581.25,436.25 L 579.25,439.00 L 579.50,440.25 L 582.75,441.75 L 584.50,439.00 L 587.75,436.25 L 594.50,435.00 L 598.50,436.50 L 600.00,438.00 L 601.00,440.00 L 601.25,443.50 L 600.75,445.75 L 598.00,450.00 L 580.00,467.50 L 580.00,471.25 L 580.75,471.75 L 606.50,471.50 L 607.00,471.00 L 606.75,467.25 L 587.00,466.75 L 587.00,466.00 L 603.00,450.50 L 605.50,445.25 L 605.75,440.50 L 603.50,435.50 L 599.00,431.75 L 591.00,430.75 Z M 632.00,428.25 L 626.75,430.25 L 622.75,434.50 L 620.25,441.50 L 620.25,450.00 L 623.00,459.00 L 627.75,465.50 L 633.25,468.50 L 640.00,468.75 L 645.25,466.50 L 649.75,461.50 L 651.75,456.25 L 652.00,448.00 L 648.50,436.75 L 644.25,431.00 L 638.25,428.25 Z M 632.75,432.25 L 637.25,432.50 L 641.00,434.50 L 644.75,439.25 L 647.00,446.00 L 647.50,453.00 L 646.75,458.25 L 644.00,462.25 L 640.00,464.25 L 636.00,464.50 L 631.50,462.75 L 628.25,459.00 L 626.00,454.00 L 624.75,447.75 L 624.75,442.75 L 625.75,438.50 L 628.50,434.50 Z M 522.25,423.75 L 521.25,424.75 L 519.50,430.75 L 518.75,431.50 L 516.25,431.00 L 514.50,431.50 L 514.75,434.50 L 517.75,435.75 L 517.75,438.00 L 513.75,452.75 L 513.50,457.75 L 514.75,460.50 L 517.50,462.50 L 521.00,463.75 L 525.50,463.75 L 526.75,462.75 L 526.50,460.00 L 520.75,459.50 L 518.75,458.00 L 517.75,456.25 L 522.00,438.25 L 523.00,437.25 L 532.25,438.75 L 533.25,436.00 L 524.00,432.50 L 525.50,425.00 L 524.25,424.00 Z M 489.25,422.00 L 485.50,423.25 L 483.50,425.00 L 482.00,427.75 L 482.00,431.75 L 483.25,434.25 L 485.75,436.75 L 493.50,442.25 L 494.75,444.50 L 494.25,447.00 L 491.75,449.00 L 488.00,449.00 L 482.75,446.50 L 478.50,442.00 L 476.50,442.50 L 475.50,443.75 L 477.50,447.00 L 481.25,450.50 L 485.75,452.50 L 491.25,453.50 L 494.75,452.75 L 497.50,450.75 L 499.00,447.75 L 499.25,444.50 L 497.75,440.75 L 487.00,432.00 L 486.25,430.50 L 486.50,428.00 L 488.00,426.50 L 492.00,426.00 L 496.75,428.00 L 501.00,432.25 L 502.25,432.25 L 504.00,430.75 L 504.00,430.00 L 500.50,426.00 L 497.50,423.75 L 493.25,422.25 Z M 678.00,415.25 L 671.50,415.50 L 665.50,418.50 L 662.00,422.50 L 660.00,428.50 L 660.25,430.25 L 663.75,430.75 L 666.50,424.00 L 668.75,421.75 L 673.50,419.75 L 676.75,420.00 L 678.75,421.00 L 681.75,425.00 L 682.00,427.50 L 681.00,432.50 L 670.00,455.25 L 671.25,459.50 L 696.25,449.50 L 695.00,446.25 L 694.00,445.75 L 677.00,452.75 L 676.00,452.50 L 683.75,436.25 L 686.25,427.25 L 685.75,423.00 L 683.75,419.25 L 681.50,417.00 Z M 709.50,398.00 L 704.75,400.50 L 702.25,403.00 L 700.50,406.25 L 699.25,414.25 L 700.75,420.50 L 704.50,428.00 L 711.75,435.25 L 717.25,437.00 L 723.50,436.25 L 728.00,433.75 L 732.75,427.75 L 733.75,422.00 L 732.50,417.75 L 731.00,415.25 L 727.50,412.00 L 724.25,410.50 L 719.50,410.25 L 714.50,412.00 L 711.50,414.00 L 709.00,416.75 L 707.25,421.25 L 706.50,421.50 L 703.75,415.50 L 703.50,410.50 L 705.00,406.75 L 710.25,402.00 L 714.00,400.75 L 717.50,401.00 L 718.25,399.25 L 717.50,397.00 Z M 722.75,414.75 L 725.75,416.25 L 727.75,418.50 L 729.25,422.50 L 728.75,426.25 L 725.75,430.25 L 722.75,432.00 L 719.75,432.75 L 715.50,432.25 L 713.50,431.25 L 710.25,427.00 L 710.75,421.00 L 715.25,416.00 L 718.25,414.75 Z M 456.50,392.00 L 451.75,399.50 L 443.00,416.00 L 437.50,428.25 L 460.00,440.50 L 461.75,440.75 L 463.50,438.25 L 462.50,437.00 L 457.00,433.50 L 444.25,427.25 L 443.50,425.75 L 450.25,413.50 L 455.25,415.50 L 467.75,422.50 L 469.25,421.25 L 469.50,418.50 L 452.75,409.50 L 452.25,408.25 L 458.25,397.75 L 477.50,407.50 L 479.00,407.25 L 480.25,404.50 L 479.25,403.25 Z M 1109.50,331.50 L 1000.00,307.50 L 1000.25,308.75 L 1013.25,323.50 L 1021.25,331.25 L 1020.75,332.75 L 947.75,333.00 L 938.25,327.00 L 936.25,332.25 L 935.00,333.00 L 756.00,333.00 L 736.75,322.00 L 731.75,322.00 L 731.25,324.00 L 741.00,332.25 L 741.25,333.00 L 740.00,333.50 L 733.75,332.00 L 718.00,322.25 L 713.50,322.00 L 712.75,323.00 L 713.25,325.25 L 723.25,332.75 L 723.00,333.50 L 716.75,332.75 L 703.00,324.50 L 698.25,322.25 L 695.75,322.25 L 694.25,323.50 L 694.75,325.25 L 705.50,333.25 L 705.00,333.75 L 685.75,333.75 L 683.00,335.50 L 682.75,338.00 L 684.50,340.50 L 686.00,341.00 L 704.50,341.25 L 702.75,343.25 L 693.25,349.75 L 693.00,351.25 L 694.25,352.75 L 698.00,352.50 L 716.00,341.50 L 721.75,341.00 L 722.75,341.75 L 712.00,349.75 L 711.75,351.00 L 712.75,352.25 L 716.75,352.50 L 733.00,342.50 L 735.75,341.25 L 740.00,341.00 L 740.25,342.00 L 730.75,349.50 L 730.50,350.75 L 731.50,352.25 L 735.75,352.50 L 748.00,345.00 L 755.75,341.25 L 935.25,341.00 L 937.00,343.25 L 938.25,346.50 L 939.50,346.75 L 949.00,341.00 L 1017.25,341.00 L 1017.50,342.75 L 1003.00,364.00 L 1004.00,364.50 L 1108.75,332.50 Z M 1073.75,336.25 L 1060.00,341.25 L 1021.25,352.75 L 1020.25,352.50 L 1025.50,344.50 L 1031.75,337.25 L 1070.50,335.50 Z M 1020.00,318.75 L 1021.00,318.25 L 1077.75,330.75 L 1079.25,331.25 L 1079.75,332.50 L 1072.25,333.00 L 1032.25,332.50 L 1026.25,326.50 Z M 76.75,331.25 L 77.25,332.25 L 89.50,336.50 L 180.75,363.75 L 181.75,363.50 L 181.50,362.50 L 166.50,342.00 L 166.75,340.50 L 225.25,340.50 L 234.00,346.50 L 235.00,346.00 L 238.00,340.50 L 414.25,340.50 L 433.25,351.75 L 437.50,351.50 L 438.25,350.25 L 438.00,349.00 L 428.00,340.50 L 430.25,340.00 L 434.25,340.50 L 449.50,350.25 L 453.50,352.00 L 455.00,352.00 L 457.00,350.75 L 457.00,349.00 L 447.25,341.75 L 446.25,340.50 L 446.75,340.00 L 452.50,340.50 L 467.25,349.50 L 471.50,351.50 L 474.00,351.75 L 475.50,350.75 L 475.50,348.75 L 464.75,340.50 L 465.25,340.00 L 483.25,340.25 L 485.25,339.50 L 486.75,337.00 L 486.25,334.75 L 483.50,333.00 L 464.50,333.00 L 464.00,332.50 L 475.25,323.75 L 475.25,322.25 L 473.75,321.25 L 471.00,321.25 L 453.50,331.25 L 448.00,332.75 L 446.00,332.25 L 455.50,324.75 L 456.25,323.50 L 455.50,321.25 L 451.50,321.25 L 435.50,330.75 L 430.00,332.50 L 428.25,332.00 L 437.50,324.25 L 438.00,322.25 L 437.25,321.25 L 434.00,321.00 L 431.75,321.75 L 413.00,332.25 L 244.00,332.25 L 237.75,331.75 L 235.00,326.00 L 226.00,331.50 L 223.25,332.25 L 164.00,332.00 L 163.75,330.25 L 185.00,307.75 L 184.25,307.00 L 173.00,309.00 L 110.50,324.00 Z M 111.75,336.25 L 112.00,335.75 L 134.75,336.75 L 153.00,336.75 L 165.00,351.75 L 164.00,352.50 L 124.00,340.75 Z M 164.75,318.50 L 152.50,332.75 L 104.00,333.00 L 103.25,332.25 L 163.25,317.75 Z M 569.75,192.75 L 568.75,193.25 L 544.00,230.25 L 497.25,292.50 L 495.00,297.50 L 495.00,305.00 L 496.25,308.00 L 501.00,313.00 L 507.50,315.50 L 513.75,315.75 L 518.00,314.75 L 520.75,313.25 L 525.25,308.75 L 546.75,266.25 L 570.75,221.25 L 577.75,209.50 L 576.00,204.50 Z M 988.50,130.50 L 987.00,132.75 L 986.75,221.75 L 987.50,224.75 L 989.75,226.50 L 993.75,226.75 L 996.00,226.00 L 998.25,223.00 L 998.25,185.75 L 999.25,185.00 L 1016.50,184.75 L 1019.75,188.25 L 1042.50,224.50 L 1045.75,226.50 L 1049.75,226.50 L 1052.00,225.75 L 1053.50,223.50 L 1053.50,221.00 L 1029.75,183.75 L 1030.50,182.50 L 1037.75,179.75 L 1042.00,177.00 L 1046.00,173.00 L 1048.50,168.75 L 1050.75,159.25 L 1050.75,152.50 L 1049.50,146.75 L 1047.50,142.25 L 1040.25,135.00 L 1030.00,130.75 L 1019.75,129.25 L 991.00,129.50 Z M 998.25,140.25 L 999.25,139.50 L 1022.00,139.50 L 1028.00,140.75 L 1032.75,143.00 L 1036.75,147.00 L 1039.00,153.25 L 1039.00,160.50 L 1038.00,164.25 L 1036.00,167.75 L 1030.50,172.75 L 1021.75,175.25 L 998.75,175.00 L 998.25,174.25 Z M 904.00,129.25 L 901.00,131.00 L 899.75,133.75 L 900.25,137.50 L 903.25,140.00 L 905.00,140.50 L 928.50,140.25 L 929.00,140.75 L 929.25,223.00 L 930.00,224.75 L 931.75,226.25 L 935.50,226.75 L 938.25,226.00 L 939.75,224.50 L 940.75,221.75 L 940.75,141.00 L 941.50,140.25 L 965.50,140.25 L 968.25,139.00 L 969.50,137.25 L 969.25,131.75 L 967.25,129.75 L 965.50,129.25 Z M 799.50,129.25 L 793.75,129.50 L 791.75,131.00 L 791.25,221.50 L 792.00,224.75 L 796.00,226.75 L 800.25,226.25 L 802.75,223.50 L 803.00,132.50 L 801.25,129.75 Z M 704.50,130.00 L 702.75,132.50 L 702.50,221.25 L 703.00,223.75 L 706.50,226.25 L 739.00,226.25 L 746.00,225.50 L 755.50,222.50 L 761.00,218.75 L 765.50,213.75 L 768.75,206.75 L 769.75,200.50 L 768.50,190.25 L 765.75,185.00 L 760.25,179.25 L 755.50,176.50 L 752.00,175.75 L 751.25,175.00 L 759.25,169.75 L 761.75,166.50 L 763.50,162.75 L 764.75,156.25 L 764.75,148.25 L 762.75,142.25 L 760.25,138.50 L 755.50,134.25 L 745.50,130.25 L 738.25,129.25 L 706.25,129.25 Z M 714.25,181.00 L 715.00,180.25 L 739.75,180.50 L 745.00,181.50 L 751.00,184.25 L 755.25,188.50 L 757.50,195.25 L 757.50,202.25 L 754.75,209.00 L 751.75,212.25 L 749.00,214.00 L 742.00,216.25 L 738.75,216.75 L 714.75,216.50 L 714.25,215.75 Z M 714.25,139.50 L 715.25,138.75 L 737.50,138.75 L 742.75,139.75 L 748.75,142.75 L 752.50,147.75 L 753.75,153.25 L 753.00,160.00 L 751.00,164.25 L 746.75,168.00 L 738.00,171.00 L 714.75,170.75 L 714.25,170.25 Z M 388.25,129.25 L 386.50,130.75 L 385.75,133.50 L 385.75,220.25 L 386.50,223.25 L 390.00,225.75 L 445.50,225.75 L 448.00,224.75 L 450.00,221.75 L 449.75,218.25 L 448.50,216.50 L 445.25,215.25 L 398.00,215.25 L 397.00,214.25 L 397.00,182.25 L 398.00,181.25 L 433.25,181.50 L 436.25,180.25 L 438.00,177.00 L 438.00,175.25 L 437.00,173.25 L 433.00,171.25 L 397.75,171.25 L 397.00,170.50 L 397.25,140.00 L 398.50,139.25 L 441.00,139.25 L 443.25,138.00 L 444.75,136.00 L 445.00,132.75 L 444.25,131.00 L 441.25,128.75 L 391.25,128.50 Z M 122.00,128.75 L 120.25,129.50 L 118.25,132.50 L 118.50,136.00 L 121.50,139.00 L 123.25,139.50 L 145.50,139.25 L 147.00,140.50 L 147.00,222.00 L 148.00,224.00 L 150.00,225.75 L 155.25,225.75 L 157.50,224.00 L 158.50,221.75 L 158.75,140.25 L 159.50,139.50 L 183.25,139.25 L 186.75,136.50 L 187.25,134.25 L 186.75,131.75 L 185.25,129.75 L 183.50,128.75 Z M 1107.75,128.00 L 1097.75,130.50 L 1090.50,134.50 L 1083.00,141.50 L 1078.00,148.50 L 1074.00,157.75 L 1072.00,167.00 L 1071.50,172.75 L 1072.00,187.00 L 1074.00,196.75 L 1078.25,206.25 L 1081.75,211.75 L 1088.75,219.00 L 1095.00,223.50 L 1103.25,226.75 L 1110.25,227.75 L 1118.00,227.75 L 1127.25,225.75 L 1135.25,221.75 L 1143.00,215.00 L 1147.25,209.25 L 1151.00,201.75 L 1153.75,192.75 L 1155.00,182.00 L 1154.75,168.75 L 1153.50,161.00 L 1150.50,152.00 L 1144.25,142.00 L 1137.25,135.25 L 1129.25,130.75 L 1123.25,128.75 L 1118.00,128.00 Z M 1111.75,138.00 L 1120.25,138.75 L 1124.00,140.00 L 1128.25,142.25 L 1133.75,147.00 L 1139.25,155.50 L 1141.75,162.50 L 1143.00,169.75 L 1143.00,183.25 L 1142.25,189.50 L 1139.75,197.50 L 1137.00,203.25 L 1133.25,208.50 L 1127.25,214.00 L 1120.25,217.00 L 1115.00,218.00 L 1110.00,217.75 L 1104.00,216.00 L 1098.00,212.50 L 1093.75,208.25 L 1089.75,203.00 L 1087.25,197.50 L 1084.50,188.75 L 1083.75,182.00 L 1083.75,171.75 L 1084.75,165.25 L 1088.00,155.00 L 1089.75,151.75 L 1093.25,147.25 L 1099.00,142.00 L 1106.25,138.75 Z M 850.00,128.25 L 844.00,129.50 L 837.50,132.50 L 833.50,135.25 L 830.00,139.50 L 827.50,143.75 L 826.00,150.00 L 826.00,154.75 L 827.25,161.00 L 829.00,164.75 L 832.25,169.00 L 838.25,173.75 L 846.00,177.50 L 854.75,180.00 L 866.50,184.50 L 874.50,189.75 L 877.25,193.00 L 879.00,197.25 L 879.25,202.50 L 878.50,205.75 L 876.00,210.25 L 872.00,214.25 L 869.00,216.00 L 860.75,218.00 L 851.50,217.75 L 844.25,215.00 L 838.25,210.00 L 832.75,201.25 L 829.75,199.50 L 826.25,199.75 L 824.00,201.75 L 823.25,203.25 L 823.25,206.50 L 825.25,211.25 L 828.75,216.00 L 833.25,220.25 L 837.75,223.25 L 846.50,226.75 L 854.50,227.75 L 862.25,227.75 L 871.50,225.75 L 877.50,223.00 L 882.75,219.25 L 886.75,214.75 L 890.50,206.25 L 891.25,198.00 L 890.25,192.25 L 886.50,185.00 L 882.50,181.00 L 876.75,177.00 L 868.75,173.25 L 852.00,167.75 L 842.50,162.75 L 839.50,159.50 L 837.75,155.50 L 838.00,148.75 L 838.75,146.75 L 842.50,142.00 L 848.50,138.75 L 854.00,137.75 L 860.50,138.00 L 867.00,140.00 L 870.25,142.00 L 876.00,149.50 L 878.75,151.75 L 883.75,151.50 L 885.50,149.25 L 886.00,146.75 L 884.00,141.75 L 878.75,135.25 L 873.50,131.75 L 869.25,129.75 L 862.25,128.25 Z M 223.50,128.25 L 220.75,130.25 L 214.25,146.50 L 200.00,187.00 L 188.00,219.25 L 188.25,223.50 L 189.50,225.50 L 191.75,226.50 L 195.75,226.00 L 198.50,223.50 L 205.00,204.00 L 209.25,193.75 L 246.50,193.75 L 248.75,198.25 L 258.25,224.50 L 259.75,225.75 L 263.50,226.50 L 266.75,224.75 L 268.25,222.00 L 267.50,216.25 L 251.00,173.50 L 237.75,136.50 L 235.25,130.75 L 232.25,128.25 L 230.75,127.75 Z M 227.25,139.50 L 228.25,139.75 L 231.00,146.50 L 233.00,154.00 L 243.25,182.50 L 242.00,184.25 L 213.00,184.25 L 212.00,183.50 Z M 305.50,131.50 L 297.75,137.00 L 292.25,143.25 L 287.25,152.75 L 284.75,160.50 L 282.75,176.25 L 283.50,188.00 L 285.25,196.25 L 290.00,208.00 L 294.50,214.25 L 301.00,220.50 L 305.25,223.25 L 312.75,226.50 L 323.75,227.50 L 333.50,226.00 L 342.50,221.50 L 346.75,218.00 L 350.00,213.75 L 351.00,214.50 L 351.50,224.00 L 353.75,225.75 L 356.00,226.00 L 358.25,225.25 L 359.75,224.00 L 360.50,222.00 L 360.50,183.25 L 359.75,181.75 L 357.00,179.75 L 329.00,179.25 L 326.25,181.25 L 325.50,185.00 L 326.25,186.75 L 328.75,188.75 L 348.75,189.25 L 349.75,190.25 L 349.50,199.00 L 346.25,206.25 L 341.25,212.00 L 334.25,216.25 L 327.00,217.75 L 321.50,217.75 L 317.00,216.75 L 311.75,214.25 L 307.25,211.00 L 303.50,207.25 L 300.00,202.00 L 298.00,197.50 L 295.75,189.25 L 294.75,179.75 L 294.75,171.25 L 298.00,157.25 L 302.50,149.00 L 307.25,143.75 L 312.25,140.00 L 317.25,138.00 L 322.00,137.25 L 330.75,137.75 L 334.25,138.75 L 340.00,142.00 L 344.00,146.50 L 347.25,153.00 L 349.75,155.00 L 355.00,154.75 L 356.75,153.25 L 357.75,151.00 L 357.75,148.25 L 356.75,145.50 L 351.75,138.00 L 345.75,132.75 L 339.50,129.50 L 330.00,127.25 L 319.50,127.25 L 313.50,128.25 Z M 68.25,127.50 L 61.75,128.75 L 56.50,131.00 L 50.50,135.00 L 47.25,139.00 L 44.00,145.00 L 43.25,149.75 L 43.25,154.75 L 44.25,160.25 L 48.00,167.00 L 51.75,170.75 L 55.75,173.50 L 65.00,177.50 L 82.25,183.25 L 91.25,188.75 L 94.00,191.75 L 96.00,195.75 L 96.75,200.00 L 95.75,205.50 L 93.25,210.00 L 89.75,213.50 L 86.00,215.75 L 78.25,217.50 L 68.50,217.25 L 61.25,214.50 L 55.25,209.50 L 49.75,201.00 L 47.50,199.25 L 44.75,199.00 L 42.00,200.00 L 40.25,203.00 L 40.25,205.50 L 41.25,209.00 L 45.00,214.50 L 49.25,219.00 L 54.25,222.50 L 61.00,225.50 L 70.75,227.25 L 79.75,227.25 L 85.75,226.25 L 93.25,223.50 L 98.00,220.50 L 102.75,216.00 L 106.50,209.50 L 107.75,205.25 L 108.25,197.50 L 107.50,192.75 L 105.75,188.00 L 103.25,184.00 L 95.25,177.25 L 86.50,173.00 L 67.75,166.50 L 59.00,161.50 L 56.50,158.50 L 54.50,153.00 L 55.00,148.00 L 57.25,143.75 L 61.75,139.75 L 66.25,137.75 L 71.75,137.00 L 79.00,137.50 L 85.00,139.75 L 90.00,143.75 L 93.75,149.50 L 95.75,151.00 L 100.00,151.25 L 101.00,150.75 L 103.00,148.00 L 103.00,145.00 L 102.00,142.50 L 98.25,137.25 L 95.00,134.00 L 89.00,130.25 L 85.50,128.75 L 78.25,127.50 Z M 483.25,61.00 L 507.25,110.00 L 523.00,140.25 L 528.75,149.75 L 532.00,153.00 L 537.75,155.75 L 551.50,157.00 L 556.25,160.00 L 560.50,164.75 L 581.75,203.75 L 586.25,213.75 L 635.00,308.00 L 639.50,312.75 L 646.25,315.25 L 654.50,314.75 L 661.75,311.50 L 665.00,308.25 L 666.50,302.50 L 666.50,298.75 L 665.50,295.50 L 662.50,290.25 L 642.50,265.75 L 620.00,236.00 L 586.75,188.50 L 569.50,160.75 L 566.75,155.25 L 566.00,152.00 L 566.25,146.75 L 570.25,134.25 L 569.50,125.75 L 562.50,112.50 L 535.00,72.00 L 515.00,45.00 L 513.00,43.50 L 538.25,87.75 L 552.75,111.00 L 553.00,113.00 L 551.00,115.00 L 549.25,115.25 L 546.50,113.00 L 525.75,79.75 L 505.50,50.75 L 504.00,50.25 L 522.25,84.75 L 541.75,117.50 L 541.75,119.50 L 539.50,121.50 L 537.25,121.00 L 535.75,119.50 L 508.25,75.25 L 495.75,56.75 L 494.25,56.25 L 508.00,84.00 L 530.25,123.50 L 530.75,126.75 L 529.00,128.75 L 527.00,129.00 L 524.00,126.25 L 511.50,103.75 L 485.75,62.75 L 484.25,61.00 Z M 660.75,40.25 L 656.50,40.25 L 653.25,43.25 L 634.75,72.75 L 612.25,111.25 L 580.75,169.50 L 580.75,170.75 L 589.00,183.25 L 590.25,186.25 L 596.50,182.25 L 600.25,181.00 L 607.25,180.00 L 610.75,177.75 L 619.50,162.50 L 637.50,127.50 L 648.00,105.00 L 659.50,73.50 L 663.00,58.50 L 663.50,52.50 L 663.25,43.75 Z"
      />
    </svg>
  );
}

// ─── Brand font helpers ────────────────────────────────────────────────────────
const BRAND: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif" };
const BODY:  React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" };

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "objednavky" | "uctenky" | "smeny";
type Supplier = ApiSupplier;
type SupplierItem = ApiSupplierItem;

interface OrderLine {
  item: SupplierItem;
  qty: string;
  note: string;
}

type ReceiptCategory = ReceiptUiCategory;

interface Receipt {
  id: string;
  category: ReceiptCategory;
  amount: string;
  note: string;
  timestamp: Date;
  status: "odesláno" | "chyba";
}

const RECEIPT_CATEGORIES: ReceiptCategory[] = ["Suroviny", "Nafta", "Ostatní"];

function fmtTime(d: Date) {
  return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

function qtyStep(qty: string, delta: number): string {
  const n = Number(String(qty).replace(",", "."));
  const base = Number.isFinite(n) ? n : 0;
  const next = Math.max(0.1, Math.round((base + delta) * 10) / 10);
  return String(next);
}

// ─── UI atoms ──────────────────────────────────────────────────────────────────

function PrimaryBtn({
  children, onClick, disabled, loading, type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...BRAND, letterSpacing: "0.15em" }}
      className="w-full h-14 bg-primary text-primary-foreground font-bold text-[13px] uppercase flex items-center justify-center gap-2 disabled:opacity-35 active:opacity-70 transition-opacity"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...BRAND, letterSpacing: "0.1em" }}
      className="w-full h-12 border border-border text-foreground text-[11px] font-semibold uppercase flex items-center justify-center gap-2 active:bg-secondary transition-colors"
    >
      {children}
    </button>
  );
}

function TopBar({ title, onBack, rightSlot }: {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center h-14 border-b border-border px-4 shrink-0">
      {onBack && (
        <button onClick={onBack} className="mr-3 -ml-1 p-1 text-muted-foreground active:text-foreground transition-colors">
          <ChevronLeft size={20} />
        </button>
      )}
      <span style={{ ...BRAND, letterSpacing: "0.18em" }} className="text-[11px] font-bold uppercase text-foreground flex-1">
        {title}
      </span>
      {rightSlot}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...BRAND, letterSpacing: "0.2em" }} className="text-[9px] font-semibold uppercase text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/25 text-destructive p-3 text-sm">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span style={BODY}>{msg}</span>
    </div>
  );
}

// ─── User strip (shown when logged in) ────────────────────────────────────────

function UserStrip({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try { await apiLogoutRequest(); } finally { onLogout(); }
  }

  return (
    <div className="flex items-center justify-between px-4 h-9 border-b border-border bg-muted shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <User size={11} className="text-muted-foreground shrink-0" />
        <span style={BODY} className="text-[11px] text-muted-foreground truncate">{userEmail}</span>
      </div>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-1.5 text-muted-foreground active:text-foreground transition-colors disabled:opacity-40 ml-3 shrink-0"
      >
        {loggingOut
          ? <Loader2 size={13} className="animate-spin" />
          : <LogOut size={13} />
        }
        <span style={{ ...BRAND, letterSpacing: "0.12em" }} className="text-[9px] uppercase font-semibold">Odhlásit</span>
      </button>
    </div>
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await apiLoginRequest(email, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba přihlášení. Zkuste znovu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Logo — inlined SVG, white paths on transparent, no background issues */}
      <div className="flex items-center justify-center px-8 pt-16 pb-12">
        <StageBistroLogo className="w-full max-w-[300px]" />
      </div>

      {/* Divider with label */}
      <div className="flex items-center gap-3 px-6 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span style={{ ...BRAND, letterSpacing: "0.2em" }} className="text-[9px] font-semibold uppercase text-muted-foreground">
          Provozní přístup
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6">
        {error && <ErrorBanner msg={error} />}

        <div className="flex flex-col gap-1.5">
          <SectionLabel>E-mail</SectionLabel>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Vyplňte e-mail")}
            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
            required
            style={BODY}
            className="h-12 bg-secondary px-4 text-foreground text-sm border border-border focus:outline-none focus:border-foreground/30 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <SectionLabel>Heslo</SectionLabel>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Vyplňte heslo")}
              onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
              required
              style={BODY}
              className="w-full h-12 bg-secondary pr-12 pl-4 text-foreground text-sm border border-border focus:outline-none focus:border-foreground/30 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Skrýt heslo" : "Zobrazit heslo"}
              className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-muted-foreground active:text-foreground transition-colors"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="mt-2">
          <PrimaryBtn type="submit" loading={loading}>Přihlásit</PrimaryBtn>
        </div>
      </form>

      <p style={{ ...BRAND, letterSpacing: "0.1em" }} className="text-center text-[9px] text-muted-foreground/25 pb-6 mt-auto pt-10 uppercase">
        Stage Bistro s.r.o. · Interní systém
      </p>
    </div>
  );
}

// ─── ORDERS — supplier list ────────────────────────────────────────────────────

function SuppliersScreen({ onSelect }: { onSelect: (s: Supplier) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await fetchSuppliers();
        if (!cancelled) setSuppliers(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nepodařilo se načíst dodavatele.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Objednávky" />
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : error ? (
        <div className="p-4"><ErrorBanner msg={error} /></div>
      ) : suppliers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <ShoppingCart size={32} className="text-muted-foreground/25" />
          <p style={BODY} className="text-sm text-muted-foreground">
            Zatím žádní dodavatelé — doplňte je na webu provoz.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-5 pb-1.5">
            <SectionLabel>Dodavatelé</SectionLabel>
          </div>
          {suppliers.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={`w-full flex items-center justify-between px-4 py-4 text-left active:bg-secondary transition-colors ${i < suppliers.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <span style={{ ...BRAND, letterSpacing: "0.02em" }} className="text-foreground font-semibold text-[14px]">{s.name}</span>
                <span style={BODY} className="text-muted-foreground text-xs">{s.email}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ORDERS — item checklist ───────────────────────────────────────────────────

function ItemsScreen({
  supplier, lines, onChange, onBack, onNext,
}: {
  supplier: Supplier;
  lines: OrderLine[];
  onChange: (l: OrderLine[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await fetchSupplierItems(supplier.id);
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nepodařilo se načíst položky.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supplier.id]);

  const isChecked = (it: SupplierItem) => lines.some((l) => l.item.id === it.id);
  const getLine   = (it: SupplierItem) => lines.find((l) => l.item.id === it.id);

  function toggle(it: SupplierItem) {
    if (isChecked(it)) onChange(lines.filter((l) => l.item.id !== it.id));
    else onChange([...lines, { item: it, qty: it.defaultQty?.trim() || "1", note: "" }]);
  }
  function setQty(it: SupplierItem, qty: string) {
    onChange(lines.map((l) => l.item.id === it.id ? { ...l, qty } : l));
  }
  function setItemNote(it: SupplierItem, note: string) {
    onChange(lines.map((l) => l.item.id === it.id ? { ...l, note } : l));
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title={supplier.name} onBack={onBack} />
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : error ? (
        <div className="p-4"><ErrorBanner msg={error} /></div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-1.5">
              <SectionLabel>Vyberte položky ({items.length})</SectionLabel>
            </div>
            {items.length === 0 && (
              <p style={BODY} className="px-4 py-6 text-sm text-muted-foreground">Tento dodavatel nemá aktivní položky.</p>
            )}
            {items.map((it, i) => {
              const checked = isChecked(it);
              const line    = getLine(it);
              return (
                <div key={it.id} className={i < items.length - 1 ? "border-b border-border" : ""}>
                  <button
                    onClick={() => toggle(it)}
                    className="w-full flex items-center gap-4 px-4 py-4 active:bg-secondary transition-colors text-left"
                  >
                    <div className={`w-[18px] h-[18px] shrink-0 flex items-center justify-center border transition-colors ${checked ? "bg-primary border-primary" : "border-border/60"}`}>
                      {checked && <Check size={11} className="text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 flex items-baseline justify-between">
                      <span style={BODY} className={`font-medium text-[14px] ${checked ? "text-foreground" : "text-foreground/50"}`}>{it.name}</span>
                      <span style={{ ...BRAND, letterSpacing: "0.08em" }} className="text-[10px] text-muted-foreground ml-3 shrink-0 uppercase">{it.unit}</span>
                    </div>
                  </button>
                  {checked && (
                    <div className="px-4 pb-4 flex flex-col gap-2.5 bg-muted/40">
                      <div className="flex items-center gap-3 pt-1">
                        <span style={{ ...BRAND, letterSpacing: "0.12em" }} className="text-[9px] text-muted-foreground uppercase w-16">Množství</span>
                        <div className="flex items-center">
                          <button type="button" onClick={() => setQty(it, qtyStep(line?.qty ?? "1", -1))} className="w-8 h-8 border border-border flex items-center justify-center active:bg-secondary transition-colors">
                            <Minus size={12} />
                          </button>
                          <input
                            type="text" inputMode="decimal" value={line?.qty ?? "1"}
                            onChange={(e) => setQty(it, e.target.value)}
                            style={BODY}
                            className="w-14 h-8 border-y border-border bg-background text-center text-sm text-foreground focus:outline-none"
                          />
                          <button type="button" onClick={() => setQty(it, qtyStep(line?.qty ?? "1", 1))} className="w-8 h-8 border border-border flex items-center justify-center active:bg-secondary transition-colors">
                            <Plus size={12} />
                          </button>
                          <span style={{ ...BRAND, letterSpacing: "0.08em" }} className="text-[10px] text-muted-foreground ml-2 uppercase">{it.unit}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ ...BRAND, letterSpacing: "0.12em" }} className="text-[9px] text-muted-foreground uppercase w-16">Poznámka</span>
                        <input
                          type="text" placeholder="volitelná…" value={line?.note ?? ""}
                          onChange={(e) => setItemNote(it, e.target.value)}
                          style={BODY}
                          className="flex-1 h-8 bg-background border border-border px-2 text-[13px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/25"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-4 pb-6 pt-4 border-t border-border shrink-0">
            <PrimaryBtn onClick={onNext} disabled={lines.length === 0}>
              Pokračovat{lines.length > 0 ? ` (${lines.length})` : ""}
            </PrimaryBtn>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ORDERS — note ─────────────────────────────────────────────────────────────

function OrderNoteScreen({
  lines, note, onNoteChange, onBack, onNext,
}: {
  lines: OrderLine[];
  note: string;
  onNoteChange: (n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Poznámka k objednávce" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        <div>
          <SectionLabel>Vybrané položky</SectionLabel>
          <div className="flex flex-col divide-y divide-border">
            {lines.map((l) => (
              <div key={l.item.id} className="flex items-baseline justify-between py-2.5">
                <span style={BODY} className="text-[14px] text-foreground">{l.item.name}</span>
                <span style={{ ...BRAND, letterSpacing: "0.06em" }} className="text-[11px] text-muted-foreground ml-4 shrink-0">{l.qty} {l.item.unit}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SectionLabel>Poznámka k objednávce</SectionLabel>
          <textarea
            rows={4}
            placeholder="Např.: Prosím doručit v úterý dopoledne. Kontaktujte nás den před dodávkou."
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            style={BODY}
            className="w-full bg-secondary border border-border p-3 text-[13px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/25 resize-none"
          />
        </div>
      </div>
      <div className="px-4 pb-6 pt-4 border-t border-border shrink-0">
        <PrimaryBtn onClick={onNext}>
          <Mail size={14} />
          Náhled e-mailu
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── ORDERS — email preview ────────────────────────────────────────────────────

function EmailPreviewScreen({
  supplier, subject, body, onBack, onSend, sending, error, loadingPreview,
}: {
  supplier: Supplier;
  subject: string;
  body: string;
  onBack: () => void;
  onSend: () => void;
  sending: boolean;
  error: string;
  loadingPreview: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Náhled e-mailu" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {error && <ErrorBanner msg={error} />}
        {loadingPreview ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : (
          <div className="border border-border divide-y divide-border">
            {[{ label: "Komu", value: supplier.email }, { label: "Předmět", value: subject }].map(({ label, value }) => (
              <div key={label} className="flex gap-3 px-3 py-3">
                <span style={{ ...BRAND, letterSpacing: "0.15em" }} className="text-[9px] uppercase text-muted-foreground w-14 pt-0.5 shrink-0">{label}</span>
                <span style={BODY} className="text-[13px] text-foreground break-all leading-relaxed">{value}</span>
              </div>
            ))}
            <div className="px-3 py-3">
              <span style={{ ...BRAND, letterSpacing: "0.15em" }} className="text-[9px] uppercase text-muted-foreground block mb-2.5">Tělo</span>
              <pre style={BODY} className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{body}</pre>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 pb-6 pt-4 border-t border-border shrink-0 flex flex-col gap-3">
        <PrimaryBtn onClick={onSend} loading={sending} disabled={loadingPreview || !subject}>
          <Mail size={14} />
          Odeslat dodavateli
        </PrimaryBtn>
        <GhostBtn onClick={onBack}>Zpět k úpravám</GhostBtn>
      </div>
    </div>
  );
}

// ─── ORDERS — success ──────────────────────────────────────────────────────────

function OrderSuccessScreen({ supplier, lineCount, onNew }: {
  supplier: Supplier; lineCount: number; onNew: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Odesláno" />
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 text-center">
        <div className="w-20 h-20 bg-primary flex items-center justify-center">
          <Check size={36} className="text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ ...BRAND, letterSpacing: "0.06em" }} className="text-2xl font-extrabold text-foreground tracking-tight">
            Objednávka odeslána
          </p>
          <p style={BODY} className="text-sm text-muted-foreground mt-2">{supplier.name} · {lineCount} položek</p>
          <p style={BODY} className="text-xs text-muted-foreground/60 mt-0.5">{supplier.email}</p>
        </div>
      </div>
      <div className="px-4 pb-6 pt-4 border-t border-border shrink-0">
        <PrimaryBtn onClick={onNew}>Nová objednávka</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── ORDERS tab coordinator ────────────────────────────────────────────────────

type OrderPhase = "suppliers" | "items" | "note" | "preview" | "success";

function OrdersTab() {
  const [phase, setPhase]       = useState<OrderPhase>("suppliers");
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [lines, setLines]       = useState<OrderLine[]>([]);
  const [note, setNote]         = useState("");
  const [orderId, setOrderId]   = useState<string | null>(null);
  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");
  const [sending, setSending]   = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError]       = useState("");

  function selectSupplier(s: Supplier) {
    setSupplier(s); setLines([]); setNote(""); setError(""); setOrderId(null); setPhase("items");
  }

  async function goPreview() {
    if (!supplier) return;
    for (const l of lines) {
      if (!l.qty.trim()) {
        setError(`Doplňte množství u položky ${l.item.name}`);
        return;
      }
    }
    setLoadingPreview(true);
    setError("");
    setPhase("preview");
    try {
      const created = await createOrder({
        supplierId: supplier.id,
        note: note.trim() || null,
        lines: lines.map((l) => ({
          supplierItemId: l.item.id,
          quantity: l.qty.trim(),
          lineNote: l.note.trim() || null,
        })),
      });
      setOrderId(created.orderId);
      const prev = await previewOrder(created.orderId);
      setSubject(prev.subject);
      setBody(prev.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se připravit náhled.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSend() {
    if (!orderId) return;
    setSending(true); setError("");
    try {
      const res = await sendOrder(orderId);
      if (!res.emailed) throw new Error(res.error || "E-mail se nepodařilo odeslat.");
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail se nepodařilo odeslat. Zkuste to znovu.");
    } finally {
      setSending(false);
    }
  }
  function reset() {
    setPhase("suppliers"); setSupplier(null); setLines([]); setNote(""); setError("");
    setOrderId(null); setSubject(""); setBody("");
  }

  if (phase === "suppliers") return <SuppliersScreen onSelect={selectSupplier} />;
  if (phase === "items" && supplier)
    return <ItemsScreen supplier={supplier} lines={lines} onChange={setLines} onBack={reset} onNext={() => setPhase("note")} />;
  if (phase === "note")
    return <OrderNoteScreen lines={lines} note={note} onNoteChange={setNote} onBack={() => setPhase("items")} onNext={() => void goPreview()} />;
  if (phase === "preview" && supplier)
    return (
      <EmailPreviewScreen
        supplier={supplier}
        subject={subject}
        body={body}
        onBack={() => setPhase("note")}
        onSend={() => void handleSend()}
        sending={sending}
        error={error}
        loadingPreview={loadingPreview}
      />
    );
  if (phase === "success" && supplier)
    return <OrderSuccessScreen supplier={supplier} lineCount={lines.length} onNew={reset} />;
  return null;
}

// ─── RECEIPTS tab ──────────────────────────────────────────────────────────────

function ReceiptsTab() {
  const [phase, setPhase]           = useState<"capture" | "form" | "success">("capture");
  const [imageUrl, setImageUrl]     = useState("");
  const [imageBlob, setImageBlob]   = useState<Blob | null>(null);
  const [category, setCategory]     = useState<ReceiptCategory>("Suroviny");
  const [amount, setAmount]         = useState("");
  const [note, setNote]             = useState("");
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState("");
  const [lastStatus, setLastStatus] = useState<"odesláno" | "chyba" | null>(null);
  const [receipts, setReceipts]     = useState<Receipt[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reloadReceipts() {
    setLoadingList(true);
    try {
      const rows = await fetchReceipts();
      setReceipts(
        [...rows]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 30)
          .map((r) => ({
            id: r.id,
            category: categoryFromApi(r.category),
            amount: formatCents(r.amountCents),
            note: r.note ?? "",
            timestamp: new Date(r.createdAt),
            status: (r.accountingEmailedAt ? "odesláno" : "chyba") as "odesláno" | "chyba",
          }))
      );
    } catch {
      /* keep list */
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void reloadReceipts();
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageBlob(f);
    setImageUrl(URL.createObjectURL(f));
    setPhase("form");
  }, []);

  async function handleSubmit() {
    if (!imageBlob) return;
    setSending(true); setError("");
    try {
      const res = await uploadReceipt({ file: imageBlob, category, amount, note });
      const status = res.emailed ? "odesláno" : "chyba";
      setLastStatus(status);
      setPhase("success");
      void reloadReceipts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se odeslat doklad. Zkuste znovu.");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setPhase("capture"); setImageUrl(""); setImageBlob(null); setAmount(""); setNote(""); setError(""); setLastStatus(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Účtenky" onBack={phase !== "capture" ? reset : undefined} />

      {/* CAPTURE */}
      {phase === "capture" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 pt-6 pb-4">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-border/60 flex flex-col items-center justify-center gap-5 py-14 active:bg-secondary transition-colors"
            >
              <div className="w-16 h-16 border border-border flex items-center justify-center">
                <Camera size={26} className="text-foreground" />
              </div>
              <div className="text-center">
                <p style={{ ...BRAND, letterSpacing: "0.15em" }} className="text-[12px] font-bold uppercase text-foreground">
                  Vyfotit účtenku
                </p>
                <p style={BODY} className="text-[11px] text-muted-foreground mt-1">nebo vybrat z galerie</p>
              </div>
            </button>
          </div>

          {loadingList ? (
            <div className="px-4 py-6 flex justify-center">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : receipts.length > 0 && (
            <div className="px-4 pb-6">
              <SectionLabel>Poslední doklady</SectionLabel>
              <div className="flex flex-col divide-y divide-border">
                {receipts.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-3">
                    <div className={`w-1.5 h-1.5 shrink-0 ${r.status === "odesláno" ? "bg-primary" : "bg-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span style={{ ...BRAND, letterSpacing: "0.05em" }} className="text-[13px] font-semibold text-foreground">{r.category}</span>
                        {r.amount && <span style={BODY} className="text-[13px] text-foreground ml-2 shrink-0">{r.amount}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={9} className="text-muted-foreground" />
                        <span style={BODY} className="text-[11px] text-muted-foreground">{fmtDate(r.timestamp)} {fmtTime(r.timestamp)}</span>
                        {r.note && <span style={BODY} className="text-[11px] text-muted-foreground truncate">· {r.note}</span>}
                      </div>
                    </div>
                    <span style={{ ...BRAND, letterSpacing: "0.12em" }} className={`text-[9px] uppercase shrink-0 ${r.status === "odesláno" ? "text-muted-foreground/60" : "text-destructive"}`}>
                      {r.status === "odesláno" ? "odesláno" : "bez mailu"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FORM */}
      {phase === "form" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
            {error && <ErrorBanner msg={error} />}
            {imageUrl && (
              <div className="relative w-full aspect-video bg-secondary overflow-hidden">
                <img src={imageUrl} alt="Naskenovaný doklad" className="w-full h-full object-cover" />
                <button onClick={reset} className="absolute top-2 right-2 w-7 h-7 bg-background/80 flex items-center justify-center">
                  <X size={13} />
                </button>
              </div>
            )}
            <div>
              <SectionLabel>Kategorie</SectionLabel>
              <div className="flex border border-border divide-x divide-border">
                {RECEIPT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{ ...BRAND, letterSpacing: "0.1em" }}
                    className={`flex-1 py-3 text-[11px] font-bold uppercase transition-colors ${cat === category ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground active:bg-secondary"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Částka (volitelná)</SectionLabel>
              <input
                type="text" inputMode="numeric" placeholder="Např. 1 240 Kč"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                style={BODY}
                className="h-12 bg-secondary px-4 text-foreground text-sm border border-border focus:outline-none focus:border-foreground/25 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Poznámka (volitelná)</SectionLabel>
              <input
                type="text" placeholder="Např. Makro, nákup surovin"
                value={note} onChange={(e) => setNote(e.target.value)}
                style={BODY}
                className="h-12 bg-secondary px-4 text-foreground text-sm border border-border focus:outline-none focus:border-foreground/25 transition-colors"
              />
            </div>
          </div>
          <div className="px-4 pb-6 pt-4 border-t border-border shrink-0">
            <PrimaryBtn onClick={handleSubmit} loading={sending}>
              <FileText size={14} />
              Odeslat doklad
            </PrimaryBtn>
          </div>
        </>
      )}

      {/* SUCCESS */}
      {phase === "success" && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 text-center">
            {lastStatus === "odesláno" ? (
              <>
                <div className="w-20 h-20 bg-primary flex items-center justify-center">
                  <Check size={36} className="text-primary-foreground" strokeWidth={2.5} />
                </div>
                <div>
                  <p style={{ ...BRAND, letterSpacing: "0.06em" }} className="text-2xl font-extrabold text-foreground">Uloženo a odesláno</p>
                  <p style={BODY} className="text-sm text-muted-foreground mt-2">Účtenka byla odeslána účetní.</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 border border-border flex items-center justify-center">
                  <AlertCircle size={32} className="text-muted-foreground" />
                </div>
                <div>
                  <p style={{ ...BRAND, letterSpacing: "0.06em" }} className="text-2xl font-extrabold text-foreground">Uloženo</p>
                  <p style={BODY} className="text-sm text-muted-foreground mt-2">
                    E-mail se nepodařil — doklad je uložen a bude odeslán znovu.
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="px-4 pb-6 pt-4 border-t border-border shrink-0">
            <PrimaryBtn onClick={reset}>
              <Camera size={14} />
              Další účtenka
            </PrimaryBtn>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Bottom tab bar ────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  showShifts,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  showShifts: boolean;
}) {
  const tabs = [
    { id: "objednavky" as Tab, label: "Objednávky", Icon: ShoppingCart },
    { id: "uctenky" as Tab, label: "Účtenky", Icon: Camera },
    ...(showShifts
      ? [{ id: "smeny" as Tab, label: "Směny", Icon: CalendarDays }]
      : []),
  ];

  return (
    <div className="flex border-t border-border shrink-0 bg-background" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center gap-1.5 py-3 transition-colors relative ${active === id ? "text-foreground" : "text-muted-foreground/40 active:text-muted-foreground"}`}
        >
          {active === id && <span className="absolute top-0 inset-x-8 h-px bg-foreground" />}
          <Icon size={20} strokeWidth={active === id ? 2 : 1.5} />
          <span style={{ ...BRAND, letterSpacing: "0.16em" }} className="text-[9px] font-semibold uppercase">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("objednavky");

  const showShifts = hasPermission(user?.permissions, "staff.shifts");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled && me) setUser(me);
      } catch {
        /* not logged in */
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (tab === "smeny" && !showShifts) setTab("objednavky");
  }, [tab, showShifts]);

  function handleLogin(next: AuthUser) {
    setUser(next);
  }

  function handleLogout() {
    setUser(null);
    setTab("objednavky");
  }

  return (
    <div className="flex justify-center min-h-screen" style={{ background: "#000", ...BODY }}>
      <div
        className="w-full max-w-[430px] bg-background flex flex-col overflow-hidden"
        style={{ minHeight: "100dvh", height: "100dvh" }}
      >
        {bootLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={28} />
          </div>
        ) : !user ? (
          <div className="flex-1 overflow-y-auto">
            <LoginScreen onLogin={handleLogin} />
            <InstallAppBanner />
          </div>
        ) : (
          <>
            <UserStrip userEmail={user.email} onLogout={handleLogout} />
            <InstallAppBanner />
            <div className="flex-1 overflow-hidden flex flex-col">
              {tab === "objednavky" && <OrdersTab />}
              {tab === "uctenky" && <ReceiptsTab />}
              {tab === "smeny" && <ShiftsTab permissions={user.permissions} />}
            </div>
            <TabBar active={tab} onChange={setTab} showShifts={showShifts} />
          </>
        )}
      </div>
    </div>
  );
}
