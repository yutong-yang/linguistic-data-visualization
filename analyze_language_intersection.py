#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
语言数据集交集分析脚本
分析DoReCo、Grambank和D-PLACE数据集之间的语言交集
"""

import pandas as pd
import os
from pathlib import Path

def load_doreco_languages():
    """加载DoReCo语言数据"""
    try:
        df = pd.read_csv('public/doreco.csv')
        print(f"DoReCo数据集: {len(df)} 个语言")
        return df
    except FileNotFoundError:
        print("未找到doreco.csv文件")
        return None

def load_grambank_languages():
    """加载Grambank语言数据"""
    try:
        df = pd.read_csv('public/grambank-grambank-7ae000c/cldf/languages.csv')
        print(f"Grambank数据集: {len(df)} 个语言")
        return df
    except FileNotFoundError:
        print("未找到Grambank languages.csv文件")
        return None

def load_dplace_societies():
    """加载D-PLACE社会数据"""
    try:
        df = pd.read_csv('public/dplace-cldf/cldf/societies.csv')
        print(f"D-PLACE数据集: {len(df)} 个社会")
        return df
    except FileNotFoundError:
        print("未找到D-PLACE societies.csv文件")
        return None

def load_combined_data():
    """加载组合数据集"""
    try:
        df = pd.read_csv('public/data_gb_dplace_edge.csv')
        print(f"组合数据集: {len(df)} 个语言点")
        return df
    except FileNotFoundError:
        print("未找到data_gb_dplace_edge.csv文件")
        return None

def analyze_intersections():
    """分析数据集之间的交集"""
    print("=" * 60)
    print("语言数据集交集分析")
    print("=" * 60)
    
    # 加载数据
    doreco_df = load_doreco_languages()
    grambank_df = load_grambank_languages()
    dplace_df = load_dplace_societies()
    combined_df = load_combined_data()
    
    if doreco_df is None:
        print("无法加载DoReCo数据，退出分析")
        return
    
    # 提取DoReCo的glottocode
    doreco_glottocodes = set(doreco_df['Glottocode'].dropna().unique())
    print(f"\nDoReCo唯一glottocode数量: {len(doreco_glottocodes)}")
    
    # 分析Grambank交集
    if grambank_df is not None:
        grambank_glottocodes = set(grambank_df['Glottocode'].dropna().unique())
        grambank_intersection = doreco_glottocodes.intersection(grambank_glottocodes)
        print(f"Grambank交集: {len(grambank_intersection)} 个语言")
        
        # 显示Grambank中的DoReCo语言
        grambank_doreco = grambank_df[grambank_df['Glottocode'].isin(doreco_glottocodes)]
        print(f"Grambank中的DoReCo语言:")
        for _, row in grambank_doreco.iterrows():
            print(f"  - {row['Name']} ({row['Glottocode']})")
    
    # 分析D-PLACE交集
    if dplace_df is not None:
        dplace_glottocodes = set(dplace_df['Glottocode'].dropna().unique())
        dplace_intersection = doreco_glottocodes.intersection(dplace_glottocodes)
        print(f"\nD-PLACE交集: {len(dplace_intersection)} 个语言")
        
        # 显示D-PLACE中的DoReCo语言
        dplace_doreco = dplace_df[dplace_df['Glottocode'].isin(doreco_glottocodes)]
        print(f"D-PLACE中的DoReCo语言:")
        for _, row in dplace_doreco.iterrows():
            print(f"  - {row['Name']} ({row['Glottocode']})")
    
    # 分析组合数据集交集
    if combined_df is not None:
        combined_glottocodes = set(combined_df['Language_ID'].dropna().unique())
        combined_intersection = doreco_glottocodes.intersection(combined_glottocodes)
        print(f"\n组合数据集交集: {len(combined_intersection)} 个语言")
        
        # 显示组合数据集中的DoReCo语言
        combined_doreco = combined_df[combined_df['Language_ID'].isin(doreco_glottocodes)]
        print(f"组合数据集中的DoReCo语言:")
        for _, row in combined_doreco.iterrows():
            print(f"  - {row['Language_ID']} (在组合数据集中)")
    
    # 找出DoReCo中缺失的语言
    print(f"\n" + "=" * 60)
    print("DoReCo中缺失的语言分析")
    print("=" * 60)
    
    # Grambank缺失分析
    if grambank_df is not None:
        missing_in_grambank = doreco_glottocodes - grambank_glottocodes
        print(f"在Grambank中缺失的DoReCo语言: {len(missing_in_grambank)} 个")
        
        missing_grambank_languages = doreco_df[doreco_df['Glottocode'].isin(missing_in_grambank)]
        print(f"\nGrambank缺失的语言列表:")
        for _, row in missing_grambank_languages.iterrows():
            print(f"  - {row['Name']} ({row['Glottocode']}) - {row['Macroarea']}")
    
    # D-PLACE缺失分析
    if dplace_df is not None:
        missing_in_dplace = doreco_glottocodes - dplace_glottocodes
        print(f"\n在D-PLACE中缺失的DoReCo语言: {len(missing_in_dplace)} 个")
        
        missing_dplace_languages = doreco_df[doreco_df['Glottocode'].isin(missing_in_dplace)]
        print(f"\nD-PLACE缺失的语言列表:")
        for _, row in missing_dplace_languages.iterrows():
            print(f"  - {row['Name']} ({row['Glottocode']}) - {row['Macroarea']}")
    
    # 组合数据集缺失分析
    if combined_df is not None:
        missing_in_combined = doreco_glottocodes - combined_glottocodes
        print(f"\n在组合数据集中缺失的DoReCo语言: {len(missing_in_combined)} 个")
        
        missing_languages = doreco_df[doreco_df['Glottocode'].isin(missing_in_combined)]
        print(f"\n组合数据集缺失的语言列表:")
        for _, row in missing_languages.iterrows():
            print(f"  - {row['Name']} ({row['Glottocode']}) - {row['Macroarea']}")
    
    # 三重交集分析
    print(f"\n" + "=" * 60)
    print("三重交集分析 (Grambank ∩ D-PLACE ∩ DoReCo)")
    print("=" * 60)
    
    if grambank_df is not None and dplace_df is not None:
        # 计算三重交集
        triple_intersection = doreco_glottocodes.intersection(grambank_glottocodes).intersection(dplace_glottocodes)
        print(f"三重交集语言数量: {len(triple_intersection)} 个")
        
        if len(triple_intersection) > 0:
            print(f"\n三重交集语言列表:")
            triple_languages = doreco_df[doreco_df['Glottocode'].isin(triple_intersection)]
            for _, row in triple_languages.iterrows():
                print(f"  - {row['Name']} ({row['Glottocode']}) - {row['Macroarea']}")
        
        # 分析各种组合
        print(f"\n各种交集组合分析:")
        print(f"  - Grambank ∩ DoReCo: {len(doreco_glottocodes.intersection(grambank_glottocodes))} 个")
        print(f"  - D-PLACE ∩ DoReCo: {len(doreco_glottocodes.intersection(dplace_glottocodes))} 个")
        print(f"  - Grambank ∩ D-PLACE ∩ DoReCo: {len(triple_intersection)} 个")
        
        # 只在Grambank和DoReCo中，但不在D-PLACE中
        gb_doreco_only = doreco_glottocodes.intersection(grambank_glottocodes) - dplace_glottocodes
        print(f"  - 只在Grambank和DoReCo中 (不在D-PLACE): {len(gb_doreco_only)} 个")
        if len(gb_doreco_only) > 0:
            gb_only_languages = doreco_df[doreco_df['Glottocode'].isin(gb_doreco_only)]
            print(f"    语言列表:")
            for _, row in gb_only_languages.iterrows():
                print(f"      - {row['Name']} ({row['Glottocode']}) - {row['Macroarea']}")
        
        # 只在D-PLACE和DoReCo中，但不在Grambank中
        dplace_doreco_only = doreco_glottocodes.intersection(dplace_glottocodes) - grambank_glottocodes
        print(f"  - 只在D-PLACE和DoReCo中 (不在Grambank): {len(dplace_doreco_only)} 个")
        if len(dplace_doreco_only) > 0:
            dplace_only_languages = doreco_df[doreco_df['Glottocode'].isin(dplace_doreco_only)]
            print(f"    语言列表:")
            for _, row in dplace_only_languages.iterrows():
                print(f"      - {row['Name']} ({row['Glottocode']}) - {row['Macroarea']}")
    
    # 统计信息
    print(f"\n" + "=" * 60)
    print("统计摘要")
    print("=" * 60)
    print(f"DoReCo总语言数: {len(doreco_df)}")
    if grambank_df is not None:
        print(f"Grambank总语言数: {len(grambank_df)}")
        print(f"Grambank-DoReCo交集: {len(grambank_intersection)}")
    if dplace_df is not None:
        print(f"D-PLACE总社会数: {len(dplace_df)}")
        print(f"D-PLACE-DoReCo交集: {len(dplace_intersection)}")
    if combined_df is not None:
        print(f"组合数据集总语言数: {len(combined_df)}")
        print(f"组合数据集-DoReCo交集: {len(combined_intersection)}")
        print(f"DoReCo覆盖率: {len(combined_intersection)/len(doreco_df)*100:.1f}%")

def analyze_feature_coverage():
    """分析特征覆盖情况"""
    print(f"\n" + "=" * 60)
    print("特征覆盖分析")
    print("=" * 60)
    
    # 加载组合数据
    combined_df = load_combined_data()
    if combined_df is None:
        return
    
    # 加载DoReCo数据
    doreco_df = load_doreco_languages()
    if doreco_df is None:
        return
    
    # 找出交集
    doreco_glottocodes = set(doreco_df['Glottocode'].dropna().unique())
    combined_doreco = combined_df[combined_df['Language_ID'].isin(doreco_glottocodes)]
    
    print(f"组合数据集中的DoReCo语言: {len(combined_doreco)} 个")
    
    # 分析特征列（GB特征）
    gb_columns = [col for col in combined_df.columns if col.startswith('GB')]
    print(f"Grambank特征数量: {len(gb_columns)}")
    
    # 分析每个DoReCo语言的特征覆盖
    print(f"\nDoReCo语言特征覆盖情况:")
    for _, row in combined_doreco.iterrows():
        gb_values = [row[col] for col in gb_columns if pd.notna(row[col])]
        coverage = len(gb_values) / len(gb_columns) * 100
        print(f"  - {row['Language_ID']}: {len(gb_values)}/{len(gb_columns)} 特征 ({coverage:.1f}%)")

if __name__ == "__main__":
    # 检查当前目录
    print(f"当前工作目录: {os.getcwd()}")
    print(f"检查public目录是否存在: {os.path.exists('public')}")
    
    if os.path.exists('public'):
        print(f"public目录内容:")
        for item in os.listdir('public'):
            print(f"  - {item}")
    
    # 执行分析
    analyze_intersections()
    analyze_feature_coverage()
    
    print(f"\n分析完成！")
